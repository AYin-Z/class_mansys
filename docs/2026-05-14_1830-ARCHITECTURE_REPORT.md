# 架构报告 — 区队管理系统 (class_mansys)

> 基于 `arch-insight` 方法论分析，覆盖前后端全栈。
> 版本锚定：main 分支（2026-05-14 拉取）

---

## 1. 系统定位

**区队管理系统** 是一套面向**高校区队（即班级，军校体系下称为"区队"）**的综合管理应用。
核心解决一个问题：**区队长/团支书/各副区队长 18 项日常管理工作的数字化**，取代微信接龙 + Excel 表格的手工模式。

### 多端策略

| 端 | 状态 | 技术路径 |
|----|------|---------|
| Android APK | **主力分发** | uni-app 编译 → Capacitor 打包 → HBuilderX 云打包 APK |
| H5 (Web) | 正常可用 | uni-app 编译 → CloudBase 静态托管 |
| 微信小程序 | **已冻结** | 代码保留 tag `v1.0.0-mp-weixin`，个人资质未过审 |
| iOS | 未支持 | 代码兼容但未验证 |

---

## 2. 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                       客户端层 (uni-app 编译产物)                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐                │
│  │ Android  │   │   H5     │   │ 微信小程序    │                │
│  │   APK    │   │  (Web)   │   │  (已冻结)     │                │
│  └────┬─────┘   └─────┬────┘   └──────┬───────┘                │
│       └─────────┬─────┴────────────────┘                        │
│                 │                                                │
│      ┌──────────┴────────────┐                                  │
│      │  CloudBase JS SDK     │ → 认证会话（多种登录方式）        │
│      └──────────┬────────────┘                                  │
│                 │ uid (CloudBase 身份)                           │
│      ┌──────────┴────────────┐                                  │
│      │  request.ts           │ → JWT 自动注入 + 401 拦截        │
│      │  (uni.request 封装)    │                                  │
│      └──────────┬────────────┘                                  │
│                 │ Authorization: Bearer <JWT>                    │
└─────────────────┼───────────────────────────────────────────────┘
                  │ HTTPS
                  ▼
┌───────────────────────────────────────────────────────────────┐
│   CloudBase CloudRun（Express 容器, 最小 1 实例, 最大 5）       │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Middleware Chain:                                    │   │
│  │  helmet → cors → rate-limit → body-parser             │   │
│  │  → operationLog (写操作全部落 operation_logs 表)       │   │
│  │  → auth (JWT 校验 / 角色守卫)                         │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  MVC 分层:                                             │   │
│  │  routes/*.js → controllers/*.js → models/*.js         │   │
│  │  18 个路由 × 16 个控制器 × 18 个模型                    │   │
│  │  75+ HTTP 端点                                        │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────┬────────────────────────────────────┘
                           │ SQL
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  CloudBase MySQL 8.0 (Serverless, 25 张表)                    │
│  连接池: mysql2 promisePool (connectionLimit=10)              │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. 前端分层

```
Pages (*.vue)          ← 用户交互层（61 个页面）
  │
  ▼
Pinia Store (user.ts)  ← 全局状态（仅一个 store：用户信息 + token）
  │
  ▼
API 层 (src/api/*.ts)  ← 18 个接口文件，每个对应一个后端路由模块
  │                    ← 纯函数封装，返回 Promise
  ▼
request.ts             ← HTTP 基础层：
                       - uni.request Promise 封装
                       - JWT 自动注入
                       - 401 → 清 token + 跳注册页（防循环）
                       - 403 → PermissionError
                       - silent 选项控制 toast
  │
  ▼
后端 REST API
```

### 前端分层核心设计点

1. **API 层按业务模块拆分**：18 个 `src/api/*.ts`，每个对应一个后端路由文件。`index.ts` 统一 re-export。vs. 后端 18 个路由文件保持一一对应。

2. **单一 Pinia Store**：全局只有一个 `user` store，管理 profile / token / isAuthenticated / role。不搞多个 store 分散状态。

3. **request.ts 的 401 策略**：第一次 401 跳注册页、清 token。用 `_redirectingToLogin` 布尔锁防循环。401 后不静默，不给用户"看起来正常但实际无权限"的幻觉。

4. **条件编译**：`#ifdef APP-PLUS` / `#ifdef MP-WEIXIN` 区分 App 专属功能（`plus.runtime`、更新检查）和小程序专属功能（微信静默登录、一键获取手机号）。

---

## 4. 后端分层

```
Express App (app.js)
  │
  ▼
Middleware Chain（全局）
  ├── helmet             — HTTP 安全头
  ├── cors               — 跨域（开发期全开，生产期默认放行）
  ├── rate-limit         — 15 分钟 100 次
  ├── body-parser        — JSON + URL-encoded
  ├── operationLog       — 写操作自动审计落库（对业务透明）
  └── auth (按路由注入)  — authenticateToken / authorizeAdmin / authorizeRole
  │
  ▼
Routes (18 个文件)
  │  routes/auth.js, users.js, leave.js, notice.js, fee.js, ...
  ▼
Controllers (16 个文件)
  │  AuthController, LeaveController, FeeController, ...
  ▼
Models (18 个文件)
  │  User, Leave, Fee, Notice, Announcement, ...
  ▼
config/database.js  ← mysql2 promisePool (connectionLimit=10)
```

### 后端设计亮点

**operationLog 中间件（对业务透明）**：
- 仅在 `POST/PUT/DELETE` 请求时自动记录
- 捕获 `method, url, userId (from req.user), ip, userAgent, timestamp`
- 一个 `if (req.method !== 'GET')` 分支就覆盖了所有写操作审计
- 零侵入：业务 Controller 不需要显式调用日志函数

**JWT 守卫三层切面**：
```js
// 1. 校验登录
authenticateToken          → 验 JWT + 注入 req.user

// 2. 管理员鉴权
authorizeAdmin             → req.user.isAdmin === true

// 3. 角色精确控制
authorizeRole(LEAGUE_SECRETARY)  → 仅特定角色 ID
```

---

## 5. 认证架构（系统最关键的设计决策）

系统采用 **两条腿走路** 的认证方案：

### 两条腿

| 腿 | 技术 | 职责 | Token |
|----|------|------|-------|
| CloudBase Auth | 腾讯云开发 SDK | 前台门面：匿名/密码/手机 OTP/邮箱/微信 OpenID 多种登录 | CloudBase 会话 Token |
| 后端 JWT | jsonwebtoken | 业务接口鉴权：携带 `user.id / role / isAdmin` | 自签 JWT（24h 有效期） |

### 桥接流程（`src/utils/cloudbase.ts → syncBackendAuth()`）

```
用户 → CloudBase 登录（密码/OTP/微信）
    → 拿到 uid
    → POST /api/auth/cloudbase-login { cloudbase_uid }
    → 后端在 users 表通过 cloudbase_uid 找/建用户
    → 后端签发 JWT（含 user.id / role / isAdmin）
    → 前端存 uni.setStorageSync('backend_token')
    → 后续请求带 Authorization: Bearer <JWT>
```

**为什么这么设计**：CloudBase 提供了开箱即用的多方式登录（密码/手机号/邮箱/微信/匿名），但它的权限模型太浅；后端需要自己控制业务粒度的权限（"谁可以审批班费"是后端的事）。双轨分离了"你是谁"和"你能做什么"。

**代价**：有两个 `user.id` 概念（CloudBase uid 和 MySQL user.id），容易混淆。代码中 `req.user` 指的是 MySQL user，CloudBase uid 仅在登录桥接阶段使用。

---

## 6. 权限模型（核心抽象）

定义在 `src/constants/roles.ts`，前后端共享编码（INT）：

| 编码 | 角色 | 管理域 |
|------|------|--------|
| 0 | 学员 | 仅个人事务 |
| 1 | 区队长 | 全局管理 |
| 2 | 生活副区 | 班费收缴/报销/公示 |
| 3 | 学习副区 | 作业管理 |
| 4 | 心理副区 | 心理干预处理 |
| 5 | 团支书 | 配合区队长 |
| 6 | 组织委员 | 班费记账/投票组织 |
| 7 | 宣传委员 | 通知/公告/相册 |
| 8 | 系统管理员 | 保留 |

**权限矩阵** `PERMISSIONS` 是一个扁平映射表。示例：
```
PUBLISH_NOTICE: ADMIN_ROLE_IDS                → 所有干部可发通知
COLLECT_FEE: [LIFE_VICE, SUPER_ADMIN]         → 仅生活副区可收缴
APPROVE_FEE_USE: [CLASS_LEADER, SUPER_ADMIN]  → 仅区队长可审批班费使用
PUBLISH_HOMEWORK: [STUDY_VICE, SUPER_ADMIN]   → 仅学习副区可布置作业
```

**已知遗留耦合**：`src/utils/auth.js` 中的 `isAdminRole(role)` 比较的是**中文字符串**（"区队长"），与后端的 INT 编码不一致，导致该函数恒为 false。新代码统一使用 `hasPermission()` / `hasAnyRole()`。

---

## 7. 数据库设计（25 张表）

按业务域分组：

| 业务域 | 表 | 关系 |
|--------|----|------|
| **用户** | users, classes | N:1 |
| **请假** | leaves | → users |
| **通知** | notices, notice_reads | 1:N |
| **公告** | announcements, resources | 1:N |
| **相册** | albums, photos | 1:N |
| **班费** | expenses | → users |
| **心理** | psychological_applications | → users |
| **挑战** | challenges, challenge_applications, challenge_records | 链式 |
| **投票** | votes, vote_options, vote_records | 1:N |
| **作业** | homeworks, homework_submissions | 1:N |
| **建议箱** | suggestions | → users (匿名) |
| **抽奖** | lotteries, lottery_participants | 1:N |
| **积分** | points | → users |
| **消息** | messages | → users |
| **审计** | operation_logs | 自动记录 |

**审计表 `operation_logs` 是一个好的设计决策**：对所有写操作透明审计，不侵入业务代码。

---

## 8. 设计取舍分析

| 决策 | 收益 | 成本 | 边界 |
|------|------|------|------|
| **认证双轨** (CloudBase + JWT) | 同时获得 CloudBase 多登录方式和业务级权限控制 | 两个 user.id 概念易混淆；登录流程多一次 HTTP 调用 | 小团队内部使用可接受，上规模后应考虑统一认证 |
| **单一 Pinia Store** | 状态集中，调试简单 | 所有组件依赖同一个 store，弱模块隔离 | 页面数 < 100 时合理，超过应考虑拆分 |
| **operationLog 透明审计** | 写操作全部可追溯，零业务侵入 | 多一次 db INSERT，QPS 压力增加 | 适合管理类应用（审计是刚需），不适合高并发 |
| **前后端共享编码 (INT 角色)** | 前后端权限判定一致，不会不同步 | 编码变更需同步更新 | 角色数量少（9 个），变更频率低，当前设计足够 |
| **uni-app 条件编译** | 一套代码覆盖三端 | 条件编译散落各处，可读性略降 | 仅 App 和小程序差异处使用，占比 < 5% |
| **CORS 生产期全放行** | 调试方便 | 安全策略宽松 | 依赖 CloudRun 网络隔离 + JWT 鉴权补偿 |

---

## 9. 历史遗留与已知债务

1. **`src/utils/auth.js` 的 `isAdminRole()` 用中文字符串比 INT** → 恒为 false，后端权限判断才是真
2. **tabBar 已废弃但 `custom-tab-bar.vue` 手动模拟** → 迁移过程中的过渡设计
3. **微信小程序代码冻结但不拆分** → `#ifdef MP-WEIXIN` 分支仍在编译范围内
4. **无自动化测试** → `npm test` 占位，model/controller 无覆盖
5. **CloudBase 环境 ID 在代码中硬编码兜底** → `'your-env-id'` 字符串存在生产构建中

---

## 10. 规范文件集成

已放置 `standards/` 目录到项目根目录：

| 文件 | 适用项 |
|------|--------|
| `standards/CODE_RULES.md` | Vue 3 函数式组件 + TS 类型标注 + Node.js async/await |
| `standards/MULTI_AGENT.md` | 后续多 Agent 协作开发时适用 |
| `standards/PROJECT_STANDARDS.md` | Git 提交规范 (`feat/fix/docs`)、分支策略、目录规范 |
