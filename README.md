# 区队管理系统 (Class Management System)

面向公安大学区队的综合管理平台，覆盖通知、请假、班费、投票、心理干预、擂台挑战等 16+ 功能模块。

- **Web**: https://cls.ayinserver.xin
- **APK**: Capacitor 8 → Android APK
- **源码**: https://github.com/AYin-Z/class_mansys

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 (Composition API) + TypeScript + Vite 6 + Pinia |
| 路由 | vue-router 4 (hash mode, H5+Capacitor 兼容) |
| 样式 | SCSS + rpx 响应式 (100vw/750) |
| 后端 | Node.js 18 + Express 4 + mysql2 + JWT |
| 数据库 | MySQL 8.0 |
| APK | Capacitor 8 + SplashScreen + StatusBar + Filesystem |
| 部署 | 阿里云 ECS + Cloudflare Tunnel → cls.ayinserver.xin |

---

## 快速开始

```bash
# 前端
npm install
npm run build          # 构建 → dist/

# 后端
cd backend && npm install
# 配置 backend/.env（DB 连接信息）
node app.js            # 默认端口 3000

# APK
npx cap sync android
cd android && ./gradlew assembleDebug
```

---

## 功能模块

**日常管理：** 请假审批 · 通知发布与追踪 · 作业管理 · 班费收支（收缴/支出/监督）
**互动：** 投票活动 · 匿名建议箱 · 擂台挑战赛 · 积分排名 · 抽奖活动
**行政：** 成员管理 · 区队相册 · 公告资源 · 心理干预 · 仪表盘

---

## 角色权限

9 级角色：学员 · 区队长 · 生活副区 · 学习副区 · 心理副区 · 团支书 · 组织委员 · 宣传委员 · 系统管理员

---

## 部署架构

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Browser  │    │  APK     │    │   curl   │
│  / H5    │    │Capacitor │    │   CLI    │
└────┬─────┘    └────┬─────┘    └────┬─────┘
     └───────────────┼───────────────┘
                     ▼
          ┌──────────────────┐
          │  cls.ayinserver.xin  │
          │  Cloudflare Tunnel   │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │  Express :3002   │
          │  (serve dist/ +  │
          │   API routes)    │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │    MySQL 8.0     │
          └──────────────────┘
```

---

## 提交材料

- **参赛文档**: [`docs/SUBMISSION.md`](docs/SUBMISSION.md)
- **完整项目说明**: [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md)
- **部署手册**: [`docs/deployment/`](docs/deployment/)
