# 区队管理系统 (Class Management System)

基于 UniApp + Express + MySQL 的全栈区队管理应用，部署于腾讯云开发（CloudBase），支持 H5、微信小程序等多端运行。

[![Powered by CloudBase](https://7463-tcb-advanced-a656fc-1257967285.tcb.qcloud.la/mcp/powered-by-cloudbase-badge.svg)](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

> 本项目基于 [**CloudBase AI ToolKit**](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit) 开发。

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| UniApp | 3.0.0-alpha | 跨平台应用框架（H5 / 微信小程序 / App） |
| Vue 3 | ^3.5.13 | 前端框架（Composition API） |
| TypeScript | ES2020 | 类型支持 |
| Vite | ^3.2.4 | 构建工具 |
| Sass | ^1.62.1 | CSS 预处理器 |
| @cloudbase/js-sdk | ^3.3.3 | CloudBase Web SDK（认证） |
| @cloudbase/adapter-uni-app | ^1.1.0 | CloudBase UniApp 适配器 |
| @dcloudio/uni-ui | ^1.5.12 | UniApp 官方 UI 组件库 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Express | ^4.18.2 | Web 服务框架 |
| MySQL2 | ^3.6.5 | MySQL 数据库驱动（连接池） |
| jsonwebtoken | ^9.0.2 | JWT 认证 |
| bcryptjs | ^2.4.3 | 密码哈希 |
| cors | ^2.8.5 | 跨域支持 |
| helmet | ^7.1.0 | 安全头中间件 |
| express-rate-limit | ^6.9.0 | 速率限制 |
| axios | ^1.6.0 | HTTP 客户端（微信 API 调用） |
| dotenv | ^16.3.1 | 环境变量管理 |
| multer | ^1.4.5-lts.1 | 文件上传 |

### 云服务（CloudBase）

| 服务 | 用途 |
|------|------|
| 身份认证 | 用户登录（匿名 / 手机号 / 邮箱 / 密码 / 微信 OpenID） |
| 云托管 (CloudRun) | 后端 Express 服务容器化部署 |
| MySQL 数据库 | 业务数据存储（Serverless MySQL 8.0） |
| 静态网站托管 | H5 版本部署与分发 |
| 云函数 | 微信小程序端业务逻辑（hello / login / fee / leave / notice） |
| 云存储 | 文件上传与存储 |

## 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                      客户端 (UniApp)                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  │
│  │   H5    │  │ 微信小程序 │  │  App   │  │ 其他小程序 │  │
│  └────┬────┘  └─────┬────┘  └────┬────┘  └─────┬────┘  │
│       └──────────────┴───────────┴──────────────┘       │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              src/utils/cloudbase.ts                │  │
│  │          CloudBase JS SDK (认证 + 初始化)           │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              src/utils/request.ts                  │  │
│  │        HTTP 请求封装 (uni.request + JWT)            │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              src/api/*.ts                          │  │
│  │      auth / user / leave / notice / fee             │  │
│  └───────────────────────┬───────────────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────┐
│              CloudBase 云托管 (CloudRun)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Express 后端 (backend/)                    │  │
│  │  /api/auth  /api/users  /api/leave  /api/notice   │  │
│  │  /api/fee   /api/album  /api/homework  ...        │  │
│  └────────────────────┬───────────────────────────────┘  │
│                       │                                   │
│  ┌────────────────────┴───────────────────────────────┐  │
│  │          MySQL 8.0 (Serverless)                     │  │
│  │          20+ 表 / 视图 / 索引                        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## 目录结构

```
class_manage_sys/
├── src/                                # 前端源码 (UniApp Vue 3)
│   ├── api/                            # API 接口层
│   │   ├── index.ts                    # 统一导出
│   │   ├── auth.ts                     # 认证 API
│   │   ├── user.ts                     # 用户 API
│   │   ├── leave.ts                    # 请假 API
│   │   ├── notice.ts                   # 通知 API
│   │   └── fee.ts                      # 班费 API
│   ├── components/                     # 公共组件
│   │   ├── custom-nav-bar.vue          # 自定义导航栏
│   │   └── show-captcha.vue           # 验证码弹窗
│   ├── pages/                          # 页面
│   │   ├── index/                      # 首页
│   │   ├── demo/                       # 云开发演示
│   │   ├── login/                      # 登录（6 种方式）
│   │   ├── profile/                    # 个人信息
│   │   ├── leave/                      # 请假销假
│   │   ├── notice/                     # 通知管理
│   │   ├── fee/                        # 班费管理
│   │   ├── announcement/               # 公告
│   │   ├── album/                      # 相册
│   │   ├── homework/                   # 作业
│   │   ├── psychological/              # 心理辅导
│   │   ├── challenge/                  # 挑战赛
│   │   ├── vote/                       # 投票
│   │   ├── suggestion/                 # 匿名建议
│   │   ├── lottery/                    # 抽奖
│   │   └── points/                     # 积分
│   ├── utils/                          # 工具模块
│   │   ├── cloudbase.ts               # CloudBase SDK 初始化 + 认证
│   │   ├── request.ts                  # HTTP 请求封装 (uni.request + JWT)
│   │   ├── auth.js                     # 权限判断 (角色/管理员)
│   │   └── index.ts                    # 通用工具函数
│   ├── static/                         # 静态资源
│   ├── App.vue                         # 应用根组件
│   ├── main.ts                         # 应用入口
│   ├── pages.json                      # 页面路由
│   └── manifest.json                   # 应用配置
│
├── backend/                            # 后端源码 (Express + MySQL)
│   ├── config/
│   │   └── database.js                # MySQL 连接池配置
│   ├── middleware/
│   │   └── auth.js                     # JWT 认证中间件
│   ├── controllers/
│   │   ├── AuthController.js           # 认证（微信登录/CloudBase 登录）
│   │   ├── LeaveController.js          # 请假
│   │   ├── NoticeController.js         # 通知
│   │   └── FeeController.js            # 班费
│   ├── models/
│   │   ├── User.js                     # 用户模型
│   │   ├── Leave.js                    # 请假模型
│   │   ├── Notice.js                   # 通知模型
│   │   └── Fee.js                      # 班费模型
│   ├── routes/
│   │   ├── auth.js                     # /api/auth
│   │   ├── users.js                    # /api/users
│   │   ├── leave.js                    # /api/leave
│   │   ├── notice.js                   # /api/notice
│   │   ├── fee.js                      # /api/fee
│   │   └── ... (9 个 stub 路由)
│   ├── app.js                          # Express 入口
│   ├── database_init.sql               # 数据库初始化脚本 (20+ 表)
│   ├── Dockerfile                      # 容器构建配置
│   └── package.json
│
├── cloudfunctions/                     # 微信云函数
│   ├── hello/                          # 示例云函数
│   ├── login/                          # 登录云函数
│   ├── fee/                            # 班费云函数
│   ├── leave/                          # 请假云函数
│   └── notice/                         # 通知云函数
│
├── .env.production                     # 生产环境变量
├── .env.local                          # 本地环境变量
├── vite.config.ts                      # Vite 构建配置
├── tsconfig.json                       # TypeScript 配置
├── cloudbaserc.json                    # CloudBase CLI 配置
├── project.config.json                 # 微信小程序项目配置
└── README.md
```

## 后端 API

### 已实现接口 (5 个模块)

| 模块 | 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|------|
| 认证 | POST | `/api/auth/login` | 无 | 微信小程序 code 登录 |
| 认证 | POST | `/api/auth/cloudbase-login` | 无 | CloudBase UID 登录 (H5/Web) |
| 认证 | POST | `/api/auth/register` | 无 | 用户注册 |
| 认证 | POST | `/api/auth/refresh` | 无 | 刷新令牌 |
| 认证 | POST | `/api/auth/logout` | JWT | 登出 |
| 认证 | GET | `/api/auth/userinfo` | JWT | 获取用户信息 |
| 用户 | GET | `/api/users` | JWT+Admin | 获取所有用户 |
| 用户 | GET | `/api/users/:id` | JWT | 获取单个用户 |
| 用户 | PUT | `/api/users/:id` | JWT | 更新用户 |
| 用户 | DELETE | `/api/users/:id` | JWT+Admin | 删除用户 |
| 请假 | POST | `/api/leave/apply` | JWT | 申请请假 |
| 请假 | GET | `/api/leave/my` | JWT | 我的请假记录 |
| 请假 | GET | `/api/leave/all` | JWT+Admin | 所有请假记录 |
| 请假 | PUT | `/api/leave/approve` | JWT+Admin | 审批请假 |
| 请假 | PUT | `/api/leave/cancel/:id` | JWT | 销假 |
| 通知 | POST | `/api/notice/create` | JWT+Admin | 发布通知 |
| 通知 | GET | `/api/notice` | JWT | 通知列表 |
| 通知 | GET | `/api/notice/:id` | JWT | 通知详情 (自动标记已读) |
| 通知 | GET | `/api/notice/unread/count` | JWT | 未读通知数 |
| 班费 | POST | `/api/fee/expense` | JWT | 提交班费记录 |
| 班费 | GET | `/api/fee/my` | JWT | 我的班费记录 |
| 班费 | GET | `/api/fee/all` | JWT+Admin | 所有班费记录 |
| 班费 | PUT | `/api/fee/approve` | JWT+Admin | 审批班费 |
| 班费 | GET | `/api/fee/balance` | JWT | 班费余额 |
| 健康检查 | GET | `/health` | 无 | 服务健康状态 |

### 开发中接口 (9 个模块)

`/api/announcement` · `/api/album` · `/api/homework` · `/api/psychological` · `/api/challenge` · `/api/vote` · `/api/suggestion` · `/api/lottery` · `/api/points`

## 数据库

MySQL 8.0 (Serverless)，包含 20+ 表：

| 表名 | 说明 |
|------|------|
| `users` | 用户账户 (openid, 学号, 角色, 手机, 邮箱) |
| `leaves` | 请假记录 (审批流) |
| `notices` / `notice_reads` | 通知 + 已读记录 |
| `expenses` | 班费收支记录 (审批流) |
| `announcements` | 公告 |
| `albums` / `photos` | 相册 + 照片 |
| `homeworks` / `homework_submissions` | 作业 + 提交 |
| `psychological_applications` | 心理辅导申请 |
| `challenges` / `challenge_applications` / `challenge_records` | 挑战赛 |
| `votes` / `vote_options` / `vote_records` | 投票 |
| `suggestions` | 匿名建议 |
| `lotteries` / `lottery_participants` | 抽奖 |
| `points` | 积分 |
| `classes` | 区队 (一~五区队) |
| `resources` / `messages` | 资源 + 消息 |

**视图**: `user_stats` (用户统计), `fee_summary` (收支汇总)

## 认证流程

```
H5 / Web 端:
  CloudBase SDK 登录 (匿名/密码/OTP/手机号)
       │
       ▼
  syncBackendAuth()  ──→  POST /api/auth/cloudbase-login  (uid)
       │
       ▼
  后端用 cloudbase_{uid} 创建/查找用户，签发 JWT
       │
       ▼
  前端存储 JWT token，后续 API 请求自动附加 Authorization 头

微信小程序端:
  wx.login() 获取 code
       │
       ▼
  POST /api/auth/login  (code + userInfo)
       │
       ▼
  后端调用微信 jscode2session 获取 openid，创建/查找用户，签发 JWT
```

## 前后端交互

前端通过 `src/utils/request.ts` 发起 HTTP 请求：

- **基础地址**: `VITE_API_BASE_URL` (生产: CloudRun 域名)
- **认证方式**: `Authorization: Bearer <JWT>`
- **Token 管理**: 登录时存入 `localStorage`，请求自动附加，401 时清除
- **API 封装**: `src/api/` 目录按业务模块划分（auth / user / leave / notice / fee）

## 部署信息

### 后端 (CloudRun)

- **服务名称**: `class-manage-sys`
- **服务类型**: 容器型 (Container)
- **访问地址**: `https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com`
- **API 基础路径**: `/api/`
- **数据库**: MySQL (CloudBase 内网 `172.17.0.6:3306`)
- **环境 ID**: `clamansys-2gsohx9469e37a41`
- **配置**: CPU 0.5 核 / 内存 1GB / 最小实例 1 / 最大实例 5

### 前端 (静态托管)

- **访问地址**: `https://clamansys-2gsohx9469e37a41-1420593393.tcloudbaseapp.com/`
- **构建命令**: `npm run build:h5`
- **输出目录**: `dist/build/h5`

## 本地开发

### 前提条件

- Node.js 16+
- 腾讯云开发账号

### 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend && npm install
```

### 环境配置

1. 复制 `.env.local`，填入 CloudBase 环境变量：
   ```
   VITE_ENV_ID=your-env-id
   VITE_PUBLISHABLE_KEY=your-publishable-key
   VITE_API_BASE_URL=http://localhost:3000
   ```

2. 复制 `backend/.env`，填入数据库和 JWT 配置

### 启动开发

```bash
# 后端
cd backend && npm run dev

# 前端 (H5)
npm run dev:h5

# 前端 (微信小程序)
npm run dev:mp-weixin
```

### 构建

```bash
npm run build:h5          # H5
npm run build:mp-weixin   # 微信小程序
```

## 管理员角色

| 角色 | 标识 | 权限 |
|------|------|------|
| 区队长 | CLASS_LEADER | 全部管理权限 |
| 生活副区 | LIFE_VICE | 班费审批 |
| 学习副区 | STUDY_VICE | 作业发布 |
| 心理副区 | PSYCHOLOGICAL_VICE | 心理辅导 |
| 团支书 | LEAGUE_SECRETARY | 通知发布 |
| 组织委员 | ORGANIZATION_COMMITTEE | 记账 |
| 宣传委员 | PUBLICITY_COMMITTEE | 公告 |

## 相关链接

- [UniApp 官方文档](https://uniapp.dcloud.io/)
- [CloudBase 官方文档](https://cloud.tencent.com/document/product/876)
- [CloudBase JS SDK](https://docs.cloudbase.net/api-reference/webv3/initialization)
- [CloudBase AI ToolKit](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)
- [云托管控制台](https://tcb.cloud.tencent.com/dev?envId=clamansys-2gsohx9469e37a41#/platform-run)

## 许可证

MIT License
