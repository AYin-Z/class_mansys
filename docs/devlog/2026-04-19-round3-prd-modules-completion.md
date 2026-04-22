# 2026-04-19 Round 3 — PRD 模块全量打通

## 本轮目标

按 PRD（`PRD.md`）盘点，把过去仅"占位"的后端模块全部建模、做接口；前端 API + 页面接通真接口，移除剩余 mock 数据。

## PRD 完成度盘点（本轮前后对照）

| 模块 | 本轮前 | 本轮后 |
| --- | --- | --- |
| 注册 / 登录 / 个人中心 | ✅ | ✅ |
| 请假 / 销假 | ✅ | ✅ |
| 通知公告 | ✅ | ✅ |
| 学习公告 / 资料 | ✅ | ✅ |
| 班级相册 | ✅ | ✅ |
| 匿名建议 | ✅ | ✅ |
| 投票 | ✅ | ✅ |
| 班费（基础流水）| ⚠️（缺多级审批/月度公示等高级流程）| ⚠️（保持现状，留给后续）|
| **班级 API** | ❌（注册页硬编码）| ✅ 后端 + 前端动态加载 |
| **作业管理** | ❌ | ✅ 发布 / 列表 / 详情 / 提交 / 批改 |
| **心理干预** | ❌ | ✅ 匿名申请 + 管理员处理 |
| **积分系统** | ❌ | ✅ 我的积分 / 排行榜 / 加扣分 |
| **擂台挑战** | ❌ | ✅ 创建 / 申请 / 审批 / 登记 / 自动换主 |
| **抽奖活动** | ❌ | ✅ 创建 / 参与 / 开奖 / 关闭 |
| **留言板** | ❌（仅有表）| ✅ 后端 list / create / delete |

> 班费高级流程（月度收款提案、免缴申请、二级审批、人均月对账、收据归档等）涉及 10+ 张额外业务表，超出本轮范围，单独排期。

## 本轮变更详情

### 后端

**新增 / 完善 Model**
- `backend/models/ClassInfo.js` —— 班级 CRUD
- `backend/models/Homework.js` —— 作业 + 提交 + 批改
- `backend/models/Psychological.js` —— 心理申请 + 处理
- `backend/models/Points.js` —— 积分流水 + 排行
- `backend/models/Challenge.js` —— 擂台 + 申请 + 记录 + 自动换主
- `backend/models/Lottery.js` —— 抽奖 + 参与 + 随机开奖 + 关闭
- `backend/models/Message.js` —— 通用留言 / 评论

**新增 / 完善 Controller**
- `ClassController` / `HomeworkController` / `PsychologicalController`
- `PointsController` / `ChallengeController` / `LotteryController` / `MessageController`

**Routes**
- 所有原 `res.json({ message: '功能开发中' })` 占位路由全部替换为真实业务实现：
  - `routes/homework.js`
  - `routes/psychological.js`
  - `routes/points.js`
  - `routes/challenge.js`
  - `routes/lottery.js`
- 新增：
  - `routes/classes.js`（在 `app.js` 注册为 `/api/classes`）
  - `routes/message.js`（在 `app.js` 注册为 `/api/message`）

**Auth 增强**
- `POST /api/auth/find-by-student`：按学号查 `user_id`，给加扣分、登记挑战记录等场景使用，免去前端硬塞 `user_id` 的耦合。

### 前端

**API 层（`src/api/*`）**
- 新增：`classes.ts`、`homework.ts`、`psychological.ts`、`points.ts`、`challenge.ts`、`lottery.ts`、`message.ts`
- 在 `api/index.ts` 中统一 re-export

**页面接真接口**
- 注册页 `pages/auth/register.vue`：班级列表改为后端动态加载（`getClasses()`），失败时回退到本地默认值，避免单一硬编码班级。
- 作业 3 件套：`pages/homework/{index,publish,detail}.vue` —— 列表 / 发布 / 详情 / 提交（CloudBase 文件上传）/ 批改
- 心理 3 件套：`pages/psychological/{index,apply,status}.vue` —— 列表（个人 + 管理员"全部待处理"）/ 匿名申请 / 详情 + 管理员处理
- 积分 3 件套：`pages/points/{index,rank,rate}.vue` —— 我的积分 + 我的名次 / Top3 + 排行榜 / 评分标准 + 管理员加扣分
- 擂台 3 件套：`pages/challenge/{index,detail,apply}.vue` —— 列表 / 详情（含申请 / 审批 / 登记结果，挑战成功自动换主）/ 创建擂台
- 抽奖 3 件套：`pages/lottery/{index,detail,create}.vue` —— 进行中 + 历史 / 详情（参与 + 中奖名单 + 管理员开奖关闭）/ 创建抽奖

### 数据库

无 schema 变更——本轮所用的全部表（`homeworks`、`homework_submissions`、`psychological_applications`、`points`、`challenges`、`challenge_applications`、`challenge_records`、`lotteries`、`lottery_participants`、`messages`、`classes`）此前 `database_init.sql` 已建好，本轮直接复用。

## 设计原则与风格保持

- 维持 Stitch "Disciplined Architecturalism" 设计：深海军蓝主色 `#001e40` / `#003366`、灰阶辅色、圆角 `18-22rpx`、拟态阴影。
- 角色判定一律走 `src/constants/roles.ts` 与 `src/stores/user.ts`，新页面统一从 Pinia 读取 `profile`，不再访问 `uni.getStorageSync('user_profile')`。
- 全部新接口走 `src/utils/request.ts`，401 自动跳注册页、403 不抢断业务、网络错误统一 toast；上传统一走 `src/utils/cloudbase.ts` 的 `app.uploadFile({ cloudPath, filePath })`。

## 验证

- `npm run build:mp-weixin` 通过，仅 Sass deprecation 警告。
- 所有页面无 lint 错误。
