# 区队管理系统 · 项目全景说明

> 本文档面向 **接手该项目的工程师** 或 **需要全面了解项目的用户**。
> 项目由 AI 辅助开发而成，此文档基于代码现状（截至 2026-04-22 `e540320` 提交）整理，作为唯一可靠的「权威现状」参考。
> 如果和其它旧文档（`README.md` / `PRD.md` / `database_design.md`）有冲突，**以本文档为准**。

---

## 目录

1. [项目简介](#1-项目简介)
2. [技术栈](#2-技术栈)
3. [系统架构](#3-系统架构)
4. [目录结构](#4-目录结构)
5. [业务模块地图](#5-业务模块地图)
6. [前端工程解析](#6-前端工程解析)
7. [后端工程解析](#7-后端工程解析)
8. [权限模型](#8-权限模型)
9. [认证与登录流程](#9-认证与登录流程)
10. [数据库设计](#10-数据库设计)
11. [跨端兼容性策略](#11-跨端兼容性策略)
12. [部署架构](#12-部署架构)
13. [本地开发指南](#13-本地开发指南)
14. [发版流程](#14-发版流程)
15. [历史遗留与已知债务](#15-历史遗留与已知债务)
16. [关键文件速查表](#16-关键文件速查表)

---

## 1. 项目简介

### 1.1 定位

**区队管理系统** 是一套面向**高校区队（即班级，军校体系下称为"区队"）**的综合管理应用。
典型用户：区队长、副区队长、团支书、委员、普通学员。

### 1.2 覆盖业务

18+ 个业务模块（按管理域划分）：

| 管理域 | 模块 |
|---|---|
| **学员生活** | 请假销假、作业管理、心理干预、意见反馈（匿名建议） |
| **组织建设** | 通知发布、公告资源、区队相册、外部系统集成 |
| **财务管理** | 班费管理（收缴/申请/审批/公示/监督/报销/投票表决） |
| **氛围建设** | 擂台挑战、积分中心、积分排行、投票表决、抽奖活动 |
| **管理员工具** | 成员管理（`/admin/members`） |
| **系统功能** | 注册登录、个人中心、App 内更新检查 |

### 1.3 多端支持

| 端 | 支持度 | 说明 |
|---|---|---|
| **Android App** | ✅ 主力 | 当前主推渠道，HBuilderX 云打包 APK 自助分发 |
| **H5 / 浏览器** | ✅ 正常 | 部署在 CloudBase 静态托管 |
| **微信小程序** | ⚠️ 冻结 | 代码保留，版本封存于 tag `v1.0.0-mp-weixin`（未过审，个人资质限制） |
| **iOS App** | ❌ 未支持 | 需苹果开发者账号，代码兼容但未验证 |
| **其它小程序** | ❌ 未支持 | manifest 里有配置但从未实际编译 |

### 1.4 为什么从小程序转到 Android App

微信小程序对「班级/团队管理」类应用要求**企业主体资质**审核，个人开发者无法通过。
因此项目整体脱离了小程序发布路线，改走 Android APK **自助分发**（CDN 下载链接，不走应用商店）。
后端/数据库/业务代码与小程序版本完全共用，仅在登录入口用 `#ifdef MP-WEIXIN` 条件编译区分。

---

## 2. 技术栈

### 2.1 前端（`src/`）

| 技术 | 版本 | 用途 |
|---|---|---|
| **uni-app** | `3.0.0-alpha` (vue3 编译器) | 跨平台框架（编译到 App/H5/微信小程序） |
| **Vue 3** | `^3.5.13` | UI 框架，全项目用 Composition API |
| **TypeScript** | - | 类型系统（`.ts` / `.vue` 混用） |
| **Pinia** | `^2.3.1` | 全局状态管理，只有一个 store：`user` |
| **Vite** | `5.2.8` | 构建工具（uni-app 官方 vite 插件） |
| **Sass** | `^1.62.1` | 样式预处理器，全项目用 SCSS |
| **@dcloudio/uni-ui** | `^1.5.12` | uni-app 官方组件库（easycom 自动注册） |
| **@cloudbase/js-sdk** | `^3.3.3` | 腾讯云开发 Web SDK（认证/会话） |
| **@cloudbase/adapter-uni-app** | `^1.1.0` | CloudBase 在 uni-app 环境的适配层 |

### 2.2 后端（`backend/`）

| 技术 | 版本 | 用途 |
|---|---|---|
| **Node.js** | 16+ | 运行时 |
| **Express** | `^4.18.2` | Web 框架 |
| **MySQL 8.0** | Serverless | 数据库（CloudBase 托管） |
| **mysql2** | `^3.6.5` | 数据库驱动（Promise + 连接池） |
| **jsonwebtoken** | `^9.0.2` | JWT 认证，24h 有效期 |
| **bcryptjs** | `^2.4.3` | 密码哈希（目前未真正使用，密码走 CloudBase） |
| **helmet** | `^7.1.0` | HTTP 安全头 |
| **express-rate-limit** | `^6.9.0` | 速率限制 (15 分钟 100 次) |
| **multer** | `^1.4.5-lts.1` | 文件上传 |
| **axios** | `^1.6.0` | 外部 HTTP 调用（微信 jscode2session） |

### 2.3 云服务（腾讯云开发 CloudBase）

| 服务 | 用途 |
|---|---|
| **CloudRun（云托管）** | 后端 Express 服务容器化部署，自动伸缩 |
| **MySQL（Serverless）** | 业务数据存储 |
| **身份认证** | 匿名/密码/手机号/邮箱/OTP/微信 OpenID 多种登录 |
| **静态托管** | H5 版本部署 |
| **云存储** | 文件上传（图片、资源） |

**环境 ID**: `clamansys-2gsohx9469e37a41`
**CloudRun 公网入口**: `https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com`

### 2.4 构建和打包

| 场景 | 命令 / 工具 |
|---|---|
| 开发调试（H5） | `npm run dev:h5`（热重载） |
| 开发调试（小程序） | `npm run dev:mp-weixin` + 微信开发者工具 |
| 生产构建（App） | `npm run build:app` → 产物 `dist/build/app/` |
| App 打包 | **HBuilderX 云打包** 或本地打包（需 Android Studio） |
| 后端部署 | `tcb cloudrun deploy` 或通过 CloudBase 控制台 |

---

## 3. 系统架构

### 3.1 整体拓扑

```
┌───────────────────────────────────────────────────────────────┐
│                    客户端（uni-app 编译产物）                   │
│  ┌──────────┐   ┌──────────┐   ┌─────────────┐               │
│  │ Android  │   │   H5     │   │ 微信小程序   │               │
│  │   APK    │   │ (Web)    │   │  (已冻结)    │               │
│  └────┬─────┘   └─────┬────┘   └──────┬──────┘               │
│       └─────────┬─────┴────────────────┘                       │
│                 │                                              │
│      ┌──────────┴────────────┐                                │
│      │  CloudBase JS SDK      │ → 认证会话（多种登录方式）    │
│      └──────────┬────────────┘                                │
│                 │ uid                                          │
│      ┌──────────┴────────────┐                                │
│      │  request.ts (uni.request + JWT)                        │
│      └──────────┬────────────┘                                │
│                 │ Authorization: Bearer <JWT>                  │
└─────────────────┼──────────────────────────────────────────────┘
                  │ HTTPS
                  ▼
┌───────────────────────────────────────────────────────────────┐
│   CloudBase CloudRun（Express 容器，最小 1 实例，最大 5）      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ middleware: helmet → cors → rate-limit → body-parser │    │
│  │            → operationLog（写操作全部落库）           │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  routes/* → controllers/* → models/*                 │    │
│  │  18 个业务模块 + /api/app (版本检查)                 │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬─────────────────────────────────────┘
                           │ SQL
                           ▼
┌───────────────────────────────────────────────────────────────┐
│           CloudBase MySQL 8.0（Serverless，25 张表）           │
│  连接池：mysql2 promisePool (connectionLimit=10)              │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 认证架构（两条腿走路）

系统有 **两套认证并存**：

1. **CloudBase 认证**（前端会话）：管理"当前是谁"的会话态，负责免密续期、手机号 OTP、邮箱验证等"前台门面"
2. **后端 JWT 认证**（业务接口）：业务接口用自签 JWT（24h）校验，携带 `user.id / role / isAdmin`

**桥接函数**：`src/utils/cloudbase.ts → syncBackendAuth()`
- 用户在前端通过 CloudBase 登录成功 → 拿到 `uid`
- 调用 `POST /api/auth/cloudbase-login`，用 `cloudbase_<uid>` 作 openid 在后端 `users` 表找/建用户
- 后端签发 JWT 返回给前端
- 前端存到 `uni.setStorageSync('backend_token')`，后续所有业务接口自动带上

这样做的好处：能同时吃 CloudBase 的密码/手机号/邮箱多套登录体系，又能保留自己的业务 JWT 权限控制。
坏处：有两个 `user.id` 概念（CloudBase uid 和后端 user.id），需要注意区分。

---

## 4. 目录结构

```
class_manage_sys/
├── src/                                 # 前端源码 (uni-app Vue 3)
│   ├── api/                             # API 接口层（每个业务一个文件）
│   │   ├── index.ts                     # 统一 re-export
│   │   ├── auth.ts                      # 登录/注册/刷新/登出/userinfo
│   │   ├── user.ts                      # 用户 CRUD
│   │   ├── leave.ts                     # 请假
│   │   ├── notice.ts                    # 通知
│   │   ├── fee.ts                       # 班费
│   │   ├── announcement.ts              # 公告
│   │   ├── album.ts                     # 相册
│   │   ├── homework.ts                  # 作业
│   │   ├── psychological.ts             # 心理
│   │   ├── challenge.ts                 # 挑战
│   │   ├── vote.ts                      # 投票
│   │   ├── suggestion.ts                # 建议
│   │   ├── lottery.ts                   # 抽奖
│   │   ├── points.ts                    # 积分
│   │   ├── classes.ts                   # 班级
│   │   ├── message.ts                   # 消息
│   │   └── admin.ts                     # 管理员功能
│   │
│   ├── components/                      # 全局组件（easycom 自动注册）
│   │   ├── custom-nav-bar.vue           # 顶部自定义导航栏（状态栏适配）
│   │   └── custom-tab-bar.vue           # 底部自定义 Tab 栏（emoji 图标）
│   │
│   ├── constants/
│   │   └── roles.ts                     # 【核心】角色/权限矩阵定义
│   │
│   ├── pages/                           # 页面（61 个 .vue 文件）
│   │   ├── index/index.vue              # 首页（主 Tab）
│   │   ├── notice/                      # 通知（主 Tab + 详情 + 发布）
│   │   ├── fee/                         # 班费（主 Tab + 9 个子页面）
│   │   ├── profile/                     # 我的（主 Tab）
│   │   ├── auth/register.vue            # 注册
│   │   ├── login/                       # 登录（多种方式）
│   │   ├── admin/members/               # 管理员-成员管理
│   │   ├── leave/                       # 请假（5 个页面）
│   │   ├── announcement/                # 公告（3 个页面）
│   │   ├── album/                       # 相册（3 个页面）
│   │   ├── psychological/               # 心理（3 个页面）
│   │   ├── challenge/                   # 挑战（3 个页面）
│   │   ├── vote/                        # 投票（3 个页面）
│   │   ├── homework/                    # 作业（3 个页面）
│   │   ├── suggestion/                  # 建议（3 个页面）
│   │   ├── lottery/                     # 抽奖（3 个页面）
│   │   ├── points/                      # 积分（3 个页面）
│   │   └── external/                    # 外部系统跳转/webview
│   │
│   ├── stores/
│   │   └── user.ts                      # 【核心】Pinia store，用户信息 + token
│   │
│   ├── utils/
│   │   ├── cloudbase.ts                 # CloudBase SDK 初始化 + 多种登录
│   │   ├── request.ts                   # HTTP 封装（401 自动跳登录）
│   │   ├── auth.js                      # 【遗留兼容】权限判断（老代码路径）
│   │   ├── update-checker.ts            # App 更新检查（仅 APP-PLUS 编译）
│   │   └── index.ts                     # 通用工具（日期/路由跳转/设备信息）
│   │
│   ├── static/
│   │   ├── app-icon.png                 # 应用图标（1024x1024）
│   │   ├── logo.png                     # 启动/加载 logo
│   │   └── images/                      # tabBar 图标（全 0 字节，已废弃）
│   │
│   ├── App.vue                          # 根组件（onLaunch: 初始化 + 静默更新）
│   ├── main.ts                          # 入口（创建 Vue 应用 + 挂载 Pinia）
│   ├── manifest.json                    # uni-app 全局配置（应用名/权限/包名）
│   ├── pages.json                       # 页面路由 + 全局样式
│   └── uni.scss                         # 全局 SCSS 变量 + mixin
│
├── backend/                             # 后端源码 (Express + MySQL)
│   ├── config/
│   │   └── database.js                  # MySQL 连接池
│   ├── middleware/
│   │   ├── auth.js                      # JWT 验证中间件
│   │   └── operationLog.js              # 写操作日志中间件（对业务透明）
│   ├── controllers/                     # 16 个控制器（处理请求 + 响应）
│   ├── models/                          # 18 个模型（纯 SQL 查询封装）
│   ├── routes/                          # 18 个路由文件
│   ├── data/
│   │   └── app-version.json             # App 版本元数据（发版时改这个）
│   ├── app.js                           # Express 入口
│   ├── database_init.sql                # 数据库建表脚本（25 张表）
│   ├── Dockerfile                       # CloudRun 容器镜像构建
│   └── package.json
│
├── docs/                                # 项目文档
│   ├── PROJECT_OVERVIEW.md              # 本文档
│   ├── android-build-guide.md           # Android APK 打包指南
│   ├── in-app-update-guide.md           # App 内更新模块使用说明
│   ├── deployment/
│   │   └── custom-domain-checklist.md   # 自定义域名备案核查
│   └── devlog/                          # 开发日志（按日期归档）
│
├── .env.development / .env.production / .env.local  # 环境变量
├── package.json                         # 前端依赖
├── vite.config.ts                       # Vite 配置
├── tsconfig.json                        # TypeScript 配置
├── README.md                            # 旧版 README（部分信息已过时）
├── PRD.md                               # 产品需求文档（对齐业务）
├── database_design.md                   # 数据库字段设计（中文文档）
└── CODEBUDDY.md                         # AI 开发辅助指南
```

---

## 5. 业务模块地图

### 5.1 模块 × 接口 × 页面对照表

| 模块 | 前端 API | 后端路由 | 主要页面 | 核心权限 |
|---|---|---|---|---|
| **认证** | `api/auth.ts` | `/api/auth` | `auth/register`、`login/*` | 公开 |
| **用户** | `api/user.ts` | `/api/users` | `profile/index` | 自己或管理员 |
| **请假** | `api/leave.ts` | `/api/leave` | `leave/{index,apply,approve,cancel,detail}` | 全员申请 / 干部审批 |
| **通知** | `api/notice.ts` | `/api/notice` | `notice/{index,detail,publish}` | 全员阅读 / 干部发布 |
| **公告** | `api/announcement.ts` | `/api/announcement` | `announcement/{index,publish,upload}` | 全员看 / 区队长发 |
| **相册** | `api/album.ts` | `/api/album` | `album/{index,create,upload}` | 全员看 / 干部管 |
| **班费** | `api/fee.ts` | `/api/fee` | `fee/*`（9 个页面） | 干部分工细粒度权限 |
| **作业** | `api/homework.ts` | `/api/homework` | `homework/{index,detail,publish}` | 全员看 / 学习副区发 |
| **心理** | `api/psychological.ts` | `/api/psychological` | `psychological/{index,apply,status}` | 全员申请 / 心理副区处理 |
| **擂台挑战** | `api/challenge.ts` | `/api/challenge` | `challenge/{index,detail,apply}` | 全员参与 |
| **投票** | `api/vote.ts` | `/api/vote` | `vote/{index,detail,create}` | 全员投票 / 干部发起 |
| **建议箱** | `api/suggestion.ts` | `/api/suggestion` | `suggestion/{index,submit,status}` | 全员匿名提 / 干部处理 |
| **抽奖** | `api/lottery.ts` | `/api/lottery` | `lottery/{index,detail,create}` | 全员参与 |
| **积分** | `api/points.ts` | `/api/points` | `points/{index,rank,rate}` | 全员查 |
| **班级** | `api/classes.ts` | `/api/classes` | （无独立页面，辅助注册） | 查询 |
| **消息** | `api/message.ts` | `/api/message` | （嵌入其它页面） | 个人 |
| **管理员** | `api/admin.ts` | `/api/admin` | `admin/members/{index,detail}` | 仅管理员 |
| **App 更新** | `utils/update-checker.ts` | `/api/app` | 嵌入 profile + App.vue onLaunch | 公开 |

### 5.2 页面数量统计

- **Tab 主页**：4 个（首页 / 通知 / 班费 / 我的）
- **业务子页面**：55+
- **登录注册**：5+
- **管理员页面**：2

---

## 6. 前端工程解析

### 6.1 分层架构

```
Page (.vue)           ← 用户交互层
  │
  ▼
Pinia Store           ← 全局状态（仅 user）
  │
  ▼
API 层 (src/api/*)    ← 业务接口封装（纯函数，一个文件对应一个后端路由模块）
  │
  ▼
request.ts            ← HTTP 请求基础层（uni.request 封装 + 401 拦截 + JWT 自动注入）
  │
  ▼
后端 REST API
```

### 6.2 核心工具文件职责

#### `src/utils/request.ts`

- 对 `uni.request` 的 Promise 化封装
- 自动附加 `Authorization: Bearer <JWT>` 头
- 401 自动跳 `/pages/auth/register`（仅跳一次，防循环）
- 403 抛 `PermissionError`（业务可 `silent` 吞掉）
- 4xx/5xx 默认 toast 提示
- 支持 `silent` 选项（静默不 toast）
- `VITE_API_BASE_URL` 未配置时明确报错（防止线上误指向测试环境）

#### `src/utils/cloudbase.ts`

对 CloudBase SDK 的业务化封装，导出：
- `init / app / auth` - 基础实例
- `initCloudBase()` - 启动时初始化，检查会话
- `login()` - 匿名登录
- `signInWithPassword(u, p)` - 自动识别手机号/邮箱/用户名
- `signInWithOtp(params)` - 手机号/邮箱 OTP
- `signInWithPhoneAuth(code)` - 微信手机号一键登录（仅小程序）
- `signInWithOpenId()` - 微信 OpenID 静默登录（仅小程序）
- `syncBackendAuth()` - 【关键】把 CloudBase 登录态同步为后端 JWT
- `logout()` - 登出清除本地

#### `src/utils/update-checker.ts`

App 内更新模块（仅 `APP-PLUS` 平台生效）：
- `getCurrentAppVersion()` - 读 `plus.runtime.version`
- `checkAppUpdate({ silent })` - 检查 + 弹框 + 下载 + 安装
- 支持强制更新（`minVersionCode`）、用户忽略、下载进度

#### `src/stores/user.ts`

全局唯一 Pinia store，管理：
- `profile: UserProfile | null` - 当前用户完整信息
- `isAuthenticated` / `role` / `isAdmin` / `roleLabel` - 衍生状态
- `hydrate()` - 同步从本地存储恢复（不发网络请求）
- `setProfile(p)` - 设置用户
- `refresh()` - 异步拉 `/api/auth/userinfo` 更新
- `logout()` - 清空所有本地状态

本地存储键：
- `backend_token` - JWT token
- `user_profile` - 用户信息 JSON

### 6.3 路由和导航

- **页面路由**：`src/pages.json` 静态声明（uni-app 要求）
- **导航方式**：`uni.navigateTo / reLaunch / navigateBack`
  - 注意：**已无 tabBar** 配置，原来的 `uni.switchTab` 全部改为 `uni.reLaunch`
- **Tab 栏**：由 `custom-tab-bar.vue` 组件在 4 个 Tab 页面内手动挂载

### 6.4 条件编译约定

uni-app 支持通过注释做条件编译，项目内常用：

```vue
<!-- 仅微信小程序编译 -->
<!-- #ifdef MP-WEIXIN -->
<button open-type="getPhoneNumber">...</button>
<!-- #endif -->

<!-- 仅 App 编译 -->
<!-- #ifdef APP-PLUS -->
<view @tap="handleCheckUpdate">检查更新</view>
<!-- #endif -->
```

```ts
// #ifdef APP-PLUS
import { checkAppUpdate } from '@/utils/update-checker'
// #endif
```

**用途**：
- 小程序专属 API（`wx.login` / `getPhoneNumber`）只在小程序编译
- App 专属功能（`plus.*` API / 更新检查）只在 App 编译
- 避免编译产物膨胀和运行时报错

---

## 7. 后端工程解析

### 7.1 分层架构（MVC 风格）

```
Express App (app.js)
  │
  ▼
middleware (helmet/cors/rate-limit/bodyparser/operationLog/auth)
  │
  ▼
routes/*.js (18 个，每个对应 /api/<module>)
  │
  ▼
controllers/*.js (16 个，处理 req/res + 调 model)
  │
  ▼
models/*.js (18 个，封装 SQL 查询)
  │
  ▼
config/database.js (mysql2 promisePool)
```

### 7.2 文件对应关系

| 路由 | 控制器 | 主要模型 | 端点数 |
|---|---|---|---|
| `routes/auth.js` | `AuthController` | `User` | 7 |
| `routes/users.js` | `AuthController` | `User` | 4 |
| `routes/leave.js` | `LeaveController` | `Leave`, `User` | 5+ |
| `routes/notice.js` | `NoticeController` | `Notice`, `User` | 4+ |
| `routes/fee.js` | `FeeController` | `Fee`, `User` | 5 |
| `routes/announcement.js` | `AnnouncementController` | `Announcement`, `Resource` | ~5 |
| `routes/album.js` | `AlbumController` | `Album`, `Photo` | ~5 |
| `routes/homework.js` | `HomeworkController` | `Homework` | ~5 |
| `routes/psychological.js` | `PsychologicalController` | `Psychological` | ~4 |
| `routes/challenge.js` | `ChallengeController` | `Challenge` | ~5 |
| `routes/vote.js` | `VoteController` | `Vote` | ~5 |
| `routes/suggestion.js` | `SuggestionController` | `Suggestion` | ~4 |
| `routes/lottery.js` | `LotteryController` | `Lottery` | ~4 |
| `routes/points.js` | `PointsController` | `Points` | ~3 |
| `routes/classes.js` | `ClassController` | `ClassInfo` | ~3 |
| `routes/message.js` | `MessageController` | `Message` | ~3 |
| `routes/admin.js` | `AdminController` | 多表 | ~3 |
| `routes/app.js` | （无 controller，直接处理） | - | 1 |

合计约 **75+ 个 HTTP 端点**。

### 7.3 关键中间件

#### `middleware/auth.js`

三个守卫函数：
- `authenticateToken` - 校验 JWT，注入 `req.user`
- `authorizeAdmin` - 要求 `req.user.isAdmin === true`
- `authorizeRole(role)` - 要求特定角色 ID

典型用法：

```js
router.post('/approve',
  authenticateToken,
  authorizeAdmin,
  LeaveController.approve
);
```

#### `middleware/operationLog.js`

**特色设计：对业务无感知的操作审计**

- 接管 `res.json`，在响应前落库一条 `operation_logs` 记录
- 只记录写操作（POST/PUT/DELETE/PATCH）
- 自动推断 `resource_type`（从 URL 的第一段）和 `action`（HTTP 动词 + 尾段）
- 自动脱敏：`password / token / secret` 字段替换为 `***`
- 写日志失败 **不影响响应**（try-catch 吞掉异常）

效果：业务代码不用写一行，所有写操作自动有审计记录。

### 7.4 JWT 结构

```js
jwt.sign({
  id: user.id,              // 后端 user.id（数字）
  openid: user.openid,       // 微信 openid 或 cloudbase_<uid>
  role: user.role,           // INT 0-8
  isAdmin: user.role > 0     // 冗余字段，方便中间件快速判断
}, JWT_SECRET, { expiresIn: '24h' });
```

### 7.5 数据库访问模式

项目**没有用 ORM**，所有查询是手写 SQL 参数化查询，例如：

```js
// models/User.js
static async findByOpenid(openid) {
  const [rows] = await db.query(
    'SELECT * FROM users WHERE openid = ?',
    [openid]
  );
  return rows[0] || null;
}
```

好处：性能透明、可控
坏处：字段变更时需要同步多个 model

---

## 8. 权限模型

### 8.1 角色定义（9 种）

定义在 `src/constants/roles.ts`：

| INT | 角色 | 英文 Key | 说明 |
|:-:|---|---|---|
| 0 | 学员 | `STUDENT` | 普通用户 |
| 1 | 区队长 | `CLASS_LEADER` | 全局管理员，类似班长 |
| 2 | 生活副区 | `LIFE_VICE` | 生活副区队长，管班费收缴 |
| 3 | 学习副区 | `STUDY_VICE` | 学习副区队长，发作业 |
| 4 | 心理副区 | `PSYCHOLOGICAL_VICE` | 心理副区队长，处理心理干预 |
| 5 | 团支书 | `LEAGUE_SECRETARY` | 团支部书记 |
| 6 | 组织委员 | `ORGANIZATION_COMMITTEE` | 管班费记账 |
| 7 | 宣传委员 | `PUBLICITY_COMMITTEE` | 管公告 |
| 8 | 系统管理员 | `SUPER_ADMIN` | 预留，当前未使用 |

后端 `users.role` 字段存这个 INT，JWT claim 里也是 INT。

### 8.2 权限矩阵

权限以业务能力为单位，**一个能力映射一组允许的角色**：

```ts
// src/constants/roles.ts
export const PERMISSIONS = {
  PUBLISH_NOTICE:      ADMIN_ROLE_IDS,                  // 所有干部
  PUBLISH_ANNOUNCEMENT:[CLASS_LEADER, SUPER_ADMIN],     // 仅区队长
  APPROVE_LEAVE:       ADMIN_ROLE_IDS,                  // 所有干部
  COLLECT_FEE:         [LIFE_VICE, SUPER_ADMIN],        // 生活副区
  BOOKKEEP_FEE:        [ORGANIZATION_COMMITTEE, SUPER_ADMIN], // 组织委员
  APPROVE_FEE_USE:     [CLASS_LEADER, SUPER_ADMIN],     // 区队长
  PUBLISH_HOMEWORK:    [STUDY_VICE, SUPER_ADMIN],       // 学习副区
  HANDLE_PSYCHOLOGICAL:[PSYCHOLOGICAL_VICE, SUPER_ADMIN], // 心理副区
  CREATE_VOTE:         ADMIN_ROLE_IDS,
  CREATE_LOTTERY:      ADMIN_ROLE_IDS,
  HANDLE_SUGGESTION:   ADMIN_ROLE_IDS,
  MANAGE_ALBUM:        ADMIN_ROLE_IDS,
  APPROVE_PHOTO:       ADMIN_ROLE_IDS,
  UPLOAD_RESOURCE:     ADMIN_ROLE_IDS,
}
```

### 8.3 权限检查

**前端**（UI 显隐）：

```ts
// 方式 1: Pinia store（推荐）
const userStore = useUserStore()
if (userStore.hasPermission('PUBLISH_NOTICE')) { ... }

// 方式 2: 遗留 API（向后兼容）
import { canPublishNotice } from '@/utils/auth.js'
if (canPublishNotice()) { ... }
```

**后端**（接口保护）：

```js
router.post('/create',
  authenticateToken,
  authorizeAdmin,          // 粗粒度：所有干部
  NoticeController.create
);
// 或
router.post('/homework',
  authenticateToken,
  authorizeRole(3),        // 细粒度：仅学习副区
  HomeworkController.create
);
```

### 8.4 历史 bug 修复记录

⚠️ 注意：早期代码 `src/utils/auth.js` 中 `isAdminRole()` 比较的是**中文字符串**（`'区队长'`），与后端返回的 **INT** 永远不相等，导致 **所有权限判断恒为 false**。

已修复：现在 `auth.js` 作为兼容层转发到 `constants/roles.ts` 的正确实现，新代码应直接使用 `useUserStore().hasPermission()` 或 `hasPermission(role, perm)`。

---

## 9. 认证与登录流程

### 9.1 三条登录路径

#### 路径 A：H5 / App 端（主流程，CloudBase + JWT 桥接）

```
用户输入手机号/密码/邮箱
  ↓
CloudBase SDK (signInWithPassword / signInWithOtp)
  ↓
CloudBase 会话成功，拿到 uid
  ↓
前端调用 syncBackendAuth()
  ↓
POST /api/auth/cloudbase-login { uid, phone?, email?, nickName? }
  ↓
后端用 `cloudbase_<uid>` 作 openid 在 users 表 find-or-create
  ↓
签发 JWT → 前端 setToken() + setProfile()
  ↓
后续业务 API 自动带 Authorization 头
```

#### 路径 B：微信小程序（已冻结，保留备份）

```
wx.login() → code
  ↓
POST /api/auth/login { code, userInfo }
  ↓
后端调 jscode2session 拿 openid
  ↓
users 表 find-or-create
  ↓
签发 JWT
```

#### 路径 C：手动注册（新用户补全信息）

```
用户填写学号/姓名/手机/邮箱/班级/身份（选填）
  ↓
POST /api/auth/register
  ↓
后端校验 → find-or-create → 签发 JWT
  ↓
如果该学号已存在，返回 { success: true, reused: true }
  （无缝复用，不报"已注册"错误）
```

### 9.2 前端登录入口（`src/pages/login/`）

- `login/index.vue` - 登录方式选择页（匿名/密码/手机/邮箱/微信）
- `login/password-login.vue` - 密码登录
- `login/phone-login.vue` - 手机号 OTP
- `login/email-login.vue` - 邮箱 OTP
- `auth/register.vue` - 完整信息注册

注：`login/index.vue` 目前 **未在 `pages.json` 注册**，实际起点是 `auth/register.vue`（从注册页跳转到各登录方式）。

### 9.3 Token 生命周期

1. 登录成功 → 前端存 `backend_token`，24h 有效期
2. 每次业务请求 → 自动附加 `Authorization: Bearer <token>`
3. 后端 JWT 过期/无效 → 返回 401
4. 前端 `request.ts` 拦截 401 → `clearToken() + redirectTo('/pages/auth/register')`
5. 用户重新登录 → 回到步骤 1

---

## 10. 数据库设计

### 10.1 表清单（25 张）

| # | 表名 | 说明 |
|---|---|---|
| 1 | `users` | 用户（openid 唯一） |
| 2 | `classes` | 班级（预置"一区队"~"五区队"） |
| 3 | `leaves` | 请假（含销假字段） |
| 4 | `notices` | 通知 |
| 5 | `notice_reads` | 通知已读记录（多对多） |
| 6 | `announcements` | 公告 |
| 7 | `resources` | 公告附带资源文件 |
| 8 | `albums` | 相册 |
| 9 | `photos` | 照片 |
| 10 | `messages` | 站内消息 |
| 11 | `expenses` | 班费收支（含审批流） |
| 12 | `psychological_applications` | 心理干预申请 |
| 13 | `challenges` | 擂台挑战 |
| 14 | `challenge_applications` | 挑战报名 |
| 15 | `challenge_records` | 挑战结果记录 |
| 16 | `votes` | 投票主表 |
| 17 | `vote_options` | 投票选项 |
| 18 | `vote_records` | 投票记录（一人一票控制） |
| 19 | `homeworks` | 作业 |
| 20 | `homework_submissions` | 作业提交 |
| 21 | `suggestions` | 匿名建议 |
| 22 | `lotteries` | 抽奖活动 |
| 23 | `lottery_participants` | 抽奖参与记录 |
| 24 | `points` | 积分明细 |
| 25 | `operation_logs` | 操作审计日志（系统级） |

### 10.2 关键设计模式

**审批流**：`leaves` / `expenses` 用 INT status 表示状态（0=待审批, 1=已通过, 2=已驳回），加 `approver_id / approval_time / approval_notes` 三个字段。

**软删除**：`leaves.is_cancelled`，不物理删除行，保留历史。

**一对多**：`albums` → `photos`、`votes` → `vote_options` → `vote_records`、`homeworks` → `homework_submissions`。

**时间戳**：所有表都带 `created_at / updated_at` TIMESTAMP + 自动更新。

**建表脚本**：`backend/database_init.sql`（可直接在 CloudBase MySQL 控制台执行）

---

## 11. 跨端兼容性策略

### 11.1 平台差异处理矩阵

| 差异点 | App (plus) | H5 | 小程序 | 处理方式 |
|---|---|---|---|---|
| 微信 `wx.login` | ❌ | ❌ | ✅ | `#ifdef MP-WEIXIN` |
| 微信 `getPhoneNumber` | ❌ | ❌ | ✅ | `#ifdef MP-WEIXIN` |
| `plus.runtime` | ✅ | ❌ | ❌ | `#ifdef APP-PLUS` |
| `plus.downloader` | ✅ | ❌ | ❌ | `#ifdef APP-PLUS` |
| `uni.switchTab` | 依赖 tabBar 配置 | 依赖 tabBar 配置 | 依赖 tabBar 配置 | 统一改 `uni.reLaunch` |
| `backdrop-filter` | ✅ | ✅ | ⚠️ 部分 | 加 `-webkit-backdrop-filter` 前缀 |
| `100vh` | ✅ | ✅ | ✅ | 注意全面屏时减去安全区 |
| CSS `env(safe-area-inset-*)` | ✅ | ✅ | ✅ | 全项目统一使用 |

### 11.2 样式适配约定

- **单位**：全项目用 **`rpx`**（uni-app 自动换算为 vw），设计稿 750 宽
- **状态栏**：所有页面 `navigationStyle: custom`，用 `custom-nav-bar` 组件自适配
- **安全区**：
  - 顶部 `padding-top: calc(env(safe-area-inset-top) + 88rpx)`
  - 底部（有 tabBar）`padding-bottom: calc(140rpx + env(safe-area-inset-bottom))`
  - 底部（无 tabBar）`padding-bottom: calc(40rpx + env(safe-area-inset-bottom))`
- **FAB 按钮**：`bottom: calc(180rpx + env(safe-area-inset-bottom))`（避开 tab-bar）
- **颜色系统**：`src/uni.scss` 定义 Disciplined Architecturalism 风格令牌（深海军蓝 + 中性灰阶）

---

## 12. 部署架构

### 12.1 生产环境

| 组件 | 服务 | 地址 / ID |
|---|---|---|
| **CloudBase 环境** | 腾讯云开发 | `clamansys-2gsohx9469e37a41` |
| **后端 CloudRun** | 容器服务 | `https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com` |
| **MySQL** | Serverless | 内网 `172.17.0.6:3306`（仅 CloudRun 可访问） |
| **H5 静态托管** | CloudBase | `https://clamansys-2gsohx9469e37a41-1420593393.tcloudbaseapp.com/` |
| **Android APK** | 待分发 | CDN 地址由 `backend/data/app-version.json` 定义 |

### 12.2 CloudRun 容器配置

- **镜像构建**：`backend/Dockerfile`
- **资源**：CPU 0.5 核 / 内存 1 GB
- **伸缩**：最小 1 实例 / 最大 5 实例
- **端口**：内部 3000
- **环境变量**（敏感信息走云开发配置，非 .env 文件）：
  - `DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_PORT`
  - `JWT_SECRET / JWT_EXPIRES_IN`（24h）
  - `APPID / APPSECRET`（微信小程序，用于 `jscode2session`）

### 12.3 前端环境变量

三份 `.env` 文件：

| 文件 | 用途 | 是否提交到 Git |
|---|---|---|
| `.env.example` | 模板 | ✅ |
| `.env.development` | 开发 | ✅ |
| `.env.production` | 生产 | ❌（含真实 Key） |
| `.env.local` | 个人覆盖 | ❌ |

关键变量：

```ini
VITE_ENV_ID=clamansys-2gsohx9469e37a41
VITE_PUBLISHABLE_KEY=eyJhbG...（CloudBase 客户端公钥）
VITE_API_BASE_URL=https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com
```

---

## 13. 本地开发指南

### 13.1 前置条件

- Node.js 16+
- npm / pnpm
- **HBuilderX**（App 打包，必需）
- 腾讯云开发账号
- MySQL 客户端（可选，直连数据库调试）

### 13.2 初始化

```bash
# 前端依赖
npm install

# 后端依赖
cd backend && npm install
```

### 13.3 环境配置

1. 复制 `.env.example` → `.env.local`，填入个人 CloudBase 环境
2. 在 `backend/` 下创建 `.env`，填入数据库连接信息（本地可用 Docker MySQL）
3. 本地数据库初始化：`mysql -u root -p < backend/database_init.sql`

### 13.4 启动开发服务

```bash
# 后端（端口 3000）
cd backend && npm run dev

# 前端 H5（浏览器实时预览）
npm run dev:h5

# 前端 App（HBuilderX 里导入 dist/build/app，点真机运行）
npm run dev:app

# 前端微信小程序（微信开发者工具里导入 dist/build/mp-weixin）
npm run dev:mp-weixin
```

### 13.5 常用脚本

```bash
npm run build:h5          # H5 生产构建 → dist/build/h5
npm run build:app         # App 生产构建 → dist/build/app（HBuilderX 云打包入口）
npm run build:mp-weixin   # 小程序构建 → dist/build/mp-weixin
```

---

## 14. 发版流程

### 14.1 Android App 发版

完整流程见 `docs/android-build-guide.md`。摘要：

1. 改 `src/manifest.json`：`versionName` 和 `versionCode` 递增
2. `npm run build:app`
3. HBuilderX → 发行 → 原生 App-云打包（选 Android，填包名 `com.clamansys`）
4. 等 5-10 分钟，下载 `.apk`
5. 上传到 CDN（推荐腾讯云 COS，成本 ~2 元/月）
6. 改 `backend/data/app-version.json`：
   ```json
   {
     "android": {
       "versionName": "1.0.1",
       "versionCode": 101,
       "downloadUrl": "https://...",
       "apkSize": 15728640,
       "changelog": "...",
       "forceUpdate": false
     }
   }
   ```
7. 重新部署后端（或热更新配置）
8. 老用户启动 App 后 3 秒自动收到更新提示

详细发版/回滚策略见 `docs/in-app-update-guide.md`。

### 14.2 H5 发版

```bash
npm run build:h5
# 把 dist/build/h5/ 上传到 CloudBase 静态托管
tcb hosting deploy dist/build/h5 --env clamansys-2gsohx9469e37a41
```

### 14.3 后端发版

```bash
cd backend
tcb cloudrun deploy
# 或通过 CloudBase 控制台手动触发容器构建
```

---

## 15. 历史遗留与已知债务

### 15.1 已修复

| 问题 | 影响 | 修复方式 |
|---|---|---|
| `auth.js` 中文角色 vs INT 比较 | 所有权限判断失效 | 重写为 `constants/roles.ts` 的兼容层 |
| tabBar 图标 0 字节 | App 底部导航空白 | 自定义 `custom-tab-bar.vue`，移除 pages.json tabBar |
| `cloudbase.ts` appSign 占位符 | App 端 SDK 初始化报错 | 环境变量按需注入 |
| 微信专属 API 在 App 端编译 | App 端报错 | `#ifdef MP-WEIXIN` 隔离 |

### 15.2 仍存在的债务

1. **`src/static/images/*.png` 是 0 字节空文件**
   - 当前已通过移除 tabBar 不再使用，但文件仍在
   - 建议：直接 `rm -rf src/static/images` 或补真实图标

2. **默认头像 `/static/images/avatar.png` 也是 0 字节**
   - 未登录/无头像时会显示空图
   - 建议：改用 CSS 生成首字符头像，或补真实 PNG

3. **`login/index.vue` 页面未注册**
   - 存在于 `src/pages/login/index.vue`，但 `pages.json` 中没有对应路由
   - 实际使用走 `auth/register.vue` 作为统一入口
   - 建议：删除或重新注册

4. **`bcryptjs` 依赖未使用**
   - 密码登录走 CloudBase，后端没有真正 hash 校验
   - 建议：清理或实现备用本地密码登录

5. **iOS 平台未验证**
   - `manifest.json` 有 `ios` 配置段但为空
   - 苹果开发者账号 +  App Store 审核 + 开发机验证缺失

6. **`backend/data/app-version.json` 文件型版本管理**
   - 发版需要手动改文件 + 重新部署
   - 建议：接入 CloudBase 数据库或管理员后台可视化

7. **`database_design.md` 含中文乱码**
   - 编码问题，文件内字符显示异常
   - 建议：用 UTF-8 重写或删除（`database_init.sql` 已是权威）

8. **`PROJECT_UPGRADE_SUMMARY.md` / `PRD.md` / `CODEBUDDY.md` 与现状脱节**
   - 多份历史文档，部分内容已过时
   - 建议：以本文档为准，其它标注 "HISTORICAL" 归档

9. **`cloudfunctions/` 目录已不存在**
   - 旧 README 还提到 5 个云函数，实际已全部迁移到 Express
   - 建议：更新 README

10. **`.agents / .codebuddy / .trae / rules / .venv / __pycache__ / _legacy` 等 AI 工具产物**
    - 散落在根目录
    - 已在 `.gitignore` 但提交历史里有残留
    - 建议：定期清理

### 15.3 可优化方向

- 把前端 API 层从手写 `post/get` 迁移到 **OpenAPI 代码生成**（后端加 swagger 注解）
- 数据库加 **ORM**（Sequelize / Prisma）减少手写 SQL 样板
- 后端路由用 **express-validator** 做统一校验
- 前端加 **错误边界**（ErrorBoundary）防止单组件崩溃影响整体
- 接入 **Sentry** 或类似错误监控
- App 端增加 **wgt 热更新**（资源包级热更新，无需重装 APK）

---

## 16. 关键文件速查表

| 我想看 / 改 | 去这个文件 |
|---|---|
| 权限规则 | `src/constants/roles.ts` + `backend/middleware/auth.js` |
| 登录逻辑 | `src/utils/cloudbase.ts` + `backend/controllers/AuthController.js` |
| HTTP 请求封装 | `src/utils/request.ts` |
| 全局用户状态 | `src/stores/user.ts` |
| 页面路由 | `src/pages.json` |
| 全局样式变量 | `src/uni.scss` |
| 应用元信息（包名/权限） | `src/manifest.json` |
| 后端入口（中间件挂载顺序） | `backend/app.js` |
| 数据库表结构 | `backend/database_init.sql` |
| 某业务接口定义 | `backend/routes/<module>.js` → `backend/controllers/<Module>Controller.js` |
| 某业务前端 API | `src/api/<module>.ts` |
| App 版本配置 | `backend/data/app-version.json` |
| App 内更新逻辑 | `src/utils/update-checker.ts` |
| Android 打包参数 | `src/manifest.json` → `app-plus.distribute.android` |
| 环境变量（前端） | `.env.development` / `.env.production` / `.env.local` |
| 环境变量（后端） | CloudBase 控制台 → CloudRun 服务 → 环境变量（非 .env 文件） |
| 文档：Android 打包 | `docs/android-build-guide.md` |
| 文档：App 发版 | `docs/in-app-update-guide.md` |
| 文档：自定义域名备案 | `docs/deployment/custom-domain-checklist.md` |
| 文档：开发日志 | `docs/devlog/*` |

---

## 附录 A · Git 分支与 Tag

| 引用 | 意义 |
|---|---|
| `main` | 主分支，当前走 Android 路线 |
| `archive/mp-weixin-v1.0.0` | 小程序版本归档分支 |
| tag `v1.0.0-mp-weixin` | 小程序版本功能完整快照（Android 迁移前基线） |

关键提交：

- `06f4e1b` 初始化项目
- `cccacab` 微信小程序版本功能完整快照
- `2ce81b3` feat(android): 适配 Android App 平台
- `e540320` feat(app): 自定义底部导航 + 应用图标 + 应用内更新模块

---

## 附录 B · AI 协作约定

本项目由 AI 辅助开发，为确保后续协作一致性：

1. **"现状唯一真相"** - 本文档、`database_init.sql`、代码本身 是现状的唯一真相。其它旧文档仅作参考
2. **提交前必 `build`** - 任何代码改动提交前应 `npm run build:app` + `cd backend && node -c app.js` 验证编译通过
3. **条件编译就近写** - 平台专属代码紧贴业务逻辑写 `#ifdef`，不要集中到一个 "platform.ts"
4. **权限判断走矩阵** - 新增权限能力加到 `PERMISSIONS` 对象，不要直接写 `role === 1`
5. **历史 bug 要有注释** - 对应修复的地方留 `// 历史 bug / legacy` 注释，方便后人搜索
6. **文档与代码同步** - 改了架构类的东西要回来更新这份 `PROJECT_OVERVIEW.md`

---

_最后更新：2026-04-22 · 对应提交 `e540320`_
