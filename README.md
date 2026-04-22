# 区队管理系统 (Class Management System)

基于 **uni-app (Vue 3) + Express + MySQL** 的全栈学生区队管理应用，后端托管于腾讯云开发（CloudBase）。当前主力分发形态为 **Android App**，同时兼容 H5 与微信小程序。

[![Powered by CloudBase](https://7463-tcb-advanced-a656fc-1257967285.tcb.qcloud.la/mcp/powered-by-cloudbase-badge.svg)](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

> 本项目基于 [**CloudBase AI ToolKit**](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit) 开发，是一个 AI 辅助的长期迭代项目。

---

## 文档导航

- **完整项目说明**: [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) — 面向接手工程师的全景文档（技术栈、架构、模块、权限、认证、DB、部署、发版、已知债务，共 16 章 + 2 附录）
- **Android 打包指南**: [`docs/android-build-guide.md`](docs/android-build-guide.md)
- **App 内更新模块**: [`docs/in-app-update-guide.md`](docs/in-app-update-guide.md)
- **部署手册**: [`docs/deployment/`](docs/deployment/)
- **开发日志**: [`docs/devlog/`](docs/devlog/)

**如果你是第一次阅读本项目，请从 `PROJECT_OVERVIEW.md` 开始。** 本 README 仅作为快速入口。

---

## 技术栈速览

| 层 | 选型 |
|---|---|
| 前端框架 | uni-app 3 + Vue 3 (Composition API) + TypeScript + Vite 3 + SCSS |
| 前端状态 | Pinia |
| 前端云服务 | `@cloudbase/js-sdk` · `@cloudbase/adapter-uni-app` |
| 后端 | Node.js 18 + Express 4 + mysql2（连接池）+ JWT |
| 数据库 | CloudBase Serverless MySQL 8.0 |
| 认证 | CloudBase（H5/App）+ 微信小程序原生 + 后端 JWT 桥接 |
| 部署 | 后端 CloudRun 容器 / H5 静态托管 / Android APK |

> 详细版本号、所有依赖和模块矩阵参见 `docs/PROJECT_OVERVIEW.md`。

---

## 目录结构速览

```
class_manage_sys/
├── src/                   # 前端 (uni-app + Vue 3)
│   ├── api/               # 14 个业务模块的 API 封装
│   ├── components/        # 公共组件（自定义导航栏 / 自定义 tabBar / ...）
│   ├── pages/             # 20+ 业务页面
│   ├── stores/            # Pinia: user / app
│   ├── utils/             # cloudbase / request / avatar / update-checker ...
│   ├── constants/roles.ts # 9 角色 + 权限矩阵
│   ├── pages.json
│   └── manifest.json
│
├── backend/               # 后端 (Express + MySQL)
│   ├── routes/            # 18+ 路由模块
│   ├── controllers/ models/ middleware/
│   ├── data/app-version.json  # 客户端版本元数据
│   ├── database_init.sql  # DB 初始化脚本（30+ 张表 / 视图 / 索引）
│   ├── Dockerfile
│   └── app.js
│
├── docs/                  # 项目文档
├── .env.*                 # 环境变量
├── cloudbaserc.json       # CloudBase CLI 配置
└── package.json
```

---

## 快速开始

### 前提

- Node.js 16+（推荐 18）
- 腾讯云 CloudBase 账号与环境 ID
- 如需打包 Android：HBuilderX（云端打包最省事）

### 安装

```bash
npm install                    # 前端依赖
cd backend && npm install      # 后端依赖
```

### 环境变量

复制 `.env.example` → `.env.local`，填入：

```
VITE_ENV_ID=your-env-id
VITE_PUBLISHABLE_KEY=your-publishable-key
VITE_API_BASE_URL=https://<your-cloudrun-domain>/api
```

后端 `.env`（放在 `backend/.env`）：

```
PORT=3000
JWT_SECRET=<随机>
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

### 开发 / 构建

```bash
# 开发
npm run dev:h5          # H5 热更新
npm run dev:app         # App 端（配合 HBuilderX 真机调试）
npm run dev:mp-weixin   # 微信小程序

# 构建
npm run build:app       # 生成 App 资源（默认 build 目标）
npm run build:h5        # H5 静态产物 -> dist/build/h5
npm run build:mp-weixin # 微信小程序产物

# 后端
cd backend && npm run dev
```

---

## 业务模块

共 **18 个** 业务模块，每个模块包含前端页面 + API 封装 + 后端路由：

请假 · 通知 · 班费 · 公告 · 相册 · 作业 · 心理辅导 · 挑战赛 · 投票 · 匿名建议 · 抽奖 · 积分 · 用户 · 认证 · 班级 · 管理后台 · 消息 · App 更新

具体字段、接口列表、权限矩阵详见 [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) 第 5 章。

---

## 角色与权限

基于 `src/constants/roles.ts` 的 9 种角色 + 权限矩阵：

| 角色 | 主要权限 |
|---|---|
| 区队长 CLASS_LEADER | 全部管理权限 |
| 生活副区 LIFE_VICE | 班费审批 |
| 学习副区 STUDY_VICE | 作业发布与批阅 |
| 心理副区 PSYCHOLOGICAL_VICE | 心理辅导 |
| 团支书 LEAGUE_SECRETARY | 通知 / 公告发布 |
| 组织委员 ORGANIZATION_COMMITTEE | 班费记账 |
| 宣传委员 PUBLICITY_COMMITTEE | 公告 / 相册 |
| 普通成员 STUDENT | 查看 + 自身操作 |
| 系统管理员 ADMIN | 一切 |

---

## 部署速览

**后端（CloudRun）**
- 服务名: `class-manage-sys`
- 环境 ID: `clamansys-2gsohx9469e37a41`
- 生产域名: `https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com`
- 构建方式: 容器型（Dockerfile 位于 `backend/`）

**前端**
- **H5 静态托管**: `https://clamansys-2gsohx9469e37a41-1420593393.tcloudbaseapp.com/`
- **Android APK**: HBuilderX → 发行 → 云端打包 → 上传自托管 / 分发平台
- **微信小程序**: 已封存版本 `v1.0.0-mp-weixin`（分支 `archive/mp-weixin-v1.0.0`）

详细发版流程参见 `PROJECT_OVERVIEW.md` 第 13 章。

---

## 相关链接

- [uni-app 官方文档](https://uniapp.dcloud.io/)
- [CloudBase 官方文档](https://cloud.tencent.com/document/product/876)
- [CloudBase JS SDK](https://docs.cloudbase.net/api-reference/webv3/initialization)
- [CloudBase AI ToolKit](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)
- [云托管控制台](https://tcb.cloud.tencent.com/dev?envId=clamansys-2gsohx9469e37a41#/platform-run)

---

## 许可证

MIT License
