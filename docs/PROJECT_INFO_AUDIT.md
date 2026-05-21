# Project Info Audit — class_mansys

> 生成日期: 2026-05-17  
> 项目路径: `/home/ayin/Current_Works/class_mansys/`  
> 技术栈: uni-app (Vue 3 + TS) 前端 · Express + MySQL 后端 · JWT 认证  
> 数据库: `class_manage_sys` (MySQL 8)  
> 后端端口: 3002 (本地) · 前端通过 CF Tunnel 公网访问  
> 团队规模: 38 人 (区队级)

---

## 1. Backend Structure

### 1.1 Controllers (16 files, ~116 个静态方法)

| # | Controller | 文件名 | 方法数 | 职责 |
|---|-----------|--------|--------|------|
| 1 | **AuthController** | `AuthController.js` | 15 | 微信登录、CloudBase 登录、学号/手机/邮箱+密码登录、注册、验证码(手机/邮箱)、token 刷新、登出、查询用户 |
| 2 | **LeaveController** | `LeaveController.js` | 6 | 请假申请/我的列表/全部列表/详情/审批/销假 |
| 3 | **NoticeController** | `NoticeController.js` | 9 | 通知创建/列表/详情/更新/删除、未读数、待办标记/完成/完成名单 |
| 4 | **AnnouncementController** | `AnnouncementController.js` | 8 | 公告 CRUD、资源上传/列表/删除 |
| 5 | **AlbumController** | `AlbumController.js` | 9 | 相册 CRUD、照片上传/审批/驳回、待审核列表 |
| 6 | **FeeController** | `FeeController.js` | 22 | 收缴批次 CRUD + 缴纳/免缴/截止、费用申请(expense) CRUD、三级审批流(审批/驳回/投票)、公示 CRUD、汇总、老端点兼容 |
| 7 | **HomeworkController** | `HomeworkController.js` | 7 | 作业 CRUD、提交、评分、待批计数 |
| 8 | **PsychologicalController** | `PsychologicalController.js` | 5 | 心理干预申请提交/我的列表/全部列表/详情/处理 |
| 9 | **ChallengeController** | `ChallengeController.js` | 7 | 擂台 CRUD、申请挑战、审批申请、记录结果、我的申请 |
| 10 | **VoteController** | `VoteController.js` | 5 | 投票创建/列表/详情/投票/关闭 |
| 11 | **SuggestionController** | `SuggestionController.js` | 5 | 匿名建议提交/全部/我的/详情/处理 |
| 12 | **LotteryController** | `LotteryController.js` | 6 | 抽奖创建/列表/详情/参与/开奖/关闭 |
| 13 | **PointsController** | `PointsController.js` | 4 | 积分记录/我的/排行/全部 |
| 14 | **ClassController** | `ClassController.js` | 2 | 班级列表/创建 |
| 15 | **MessageController** | `MessageController.js` | 3 | 留言列表/创建/删除 |
| 16 | **AdminController** | `AdminController.js` | 3 | 管理员成员列表(含分页搜索)/成员详情/近期操作记录 |

### 1.2 Models (18 files)

| # | Model 文件 | 对应数据库表 |
|---|-----------|-------------|
| 1 | `models/User.js` | `users` |
| 2 | `models/Leave.js` | `leaves` |
| 3 | `models/Notice.js` | `notices`, `notice_reads`, `notice_completions` |
| 4 | `models/Announcement.js` | `announcements` |
| 5 | `models/Resource.js` | `resources` |
| 6 | `models/Album.js` | `albums` |
| 7 | `models/Photo.js` | `photos` |
| 8 | `models/Message.js` | `messages` |
| 9 | `models/Fee.js` | `expenses` |
| 10 | `models/FeeCollection.js` | `fee_collections`, `fee_collection_records` |
| 11 | `models/ExpenseApproval.js` | `expense_approvals`, `expense_approval_votes` |
| 12 | `models/FeePublication.js` | `fee_publications` |
| 13 | `models/Homework.js` | `homeworks`, `homework_submissions` |
| 14 | `models/Psychological.js` | `psychological_applications` |
| 15 | `models/Challenge.js` | `challenges`, `challenge_applications`, `challenge_records` |
| 16 | `models/Vote.js` | `votes`, `vote_options`, `vote_records` |
| 17 | `models/Suggestion.js` | `suggestions` |
| 18 | `models/Lottery.js` | `lotteries`, `lottery_participants` |
| 19 | `models/Points.js` | `points` |
| 20 | `models/ClassInfo.js` | `classes` |
| 21 | `models/OperationLog.js` | `operation_logs` |

### 1.3 Routes (18 个路由文件)

| # | 路由文件 | 挂载路径 | 认证保护 |
|---|---------|---------|---------|
| 1 | `routes/auth.js` | `/api/auth` | 部分(登录注册无需认证) |
| 2 | `routes/users.js` | `/api/users` | 全量需认证(部分需admin) |
| 3 | `routes/leave.js` | `/api/leave` | 全量需认证 |
| 4 | `routes/notice.js` | `/api/notice` | 全量需认证 |
| 5 | `routes/announcement.js` | `/api/announcement` | 全量需认证 |
| 6 | `routes/album.js` | `/api/album` | 全量需认证 |
| 7 | `routes/fee.js` | `/api/fee` | 全量需认证 |
| 8 | `routes/homework.js` | `/api/homework` | 全量需认证 |
| 9 | `routes/psychological.js` | `/api/psychological` | 全量需认证 |
| 10 | `routes/challenge.js` | `/api/challenge` | 全量需认证 |
| 11 | `routes/vote.js` | `/api/vote` | 全量需认证 |
| 12 | `routes/suggestion.js` | `/api/suggestion` | 全量需认证 |
| 13 | `routes/lottery.js` | `/api/lottery` | 全量需认证 |
| 14 | `routes/points.js` | `/api/points` | 全量需认证 |
| 15 | `routes/classes.js` | `/api/classes` | 列表无需认证，创建需认证 |
| 16 | `routes/message.js` | `/api/message` | 全量需认证 |
| 17 | `routes/admin.js` | `/api/admin` | 全量需认证+admin |
| 18 | `routes/app.js` | `/api/app` | 无需认证(版本查询) |

### 1.4 Middleware (2 个)

| 文件 | 用途 |
|------|------|
| `middleware/auth.js` | JWT 令牌验证 (`authenticateToken`)、管理员授权 (`authorizeAdmin`)、角色授权 (`authorizeRole`) |
| `middleware/operationLog.js` | 操作日志记录中间件 —— 拦截 POST/PUT/DELETE，通过劫持 `res.json` 记录写操作的耗时、状态、敏感字段脱敏 |

### 1.5 App.js 关键配置

- **端口**: `process.env.PORT || 3000` (实际部署用 3002)
- **CORS**: 白名单含 localhost:3000/3002/5173、CloudBase 域名、`cls.ayinserver.xin`、capacitor://localhost
- **静态文件**: `/uploads` 和 `/apk` 目录
- **速率限制**: `/api` 下每 IP 15 分钟 200 次
- **中间件顺序**: helmet → cors → json/urlencoded → 静态文件 → 速率限制 → 操作日志 → 路由 → SPA fallback → 404 → 错误处理
- **健康检查**: `GET /health` → `{ status: 'ok', timestamp: '...' }`
- **SPA**: 非 API/health/uploads 路径回退到 `dist/index.html`

---

## 2. Database Tables (33 张表)

### 2.1 表清单

| # | 表名 | 主键 | 核心字段 | 备注 |
|---|------|------|---------|------|
| 1 | `users` | `id` (INT AI) | `openid`(UNIQUE), `nickName`, `avatarUrl`, `gender`, `student_id`(UNIQUE), `name`, `class_id`, `role`(INT, 0=学员,1-7=干部,8=超级管理员,9=辅导员), `phone`, `email`, `created_at`, `updated_at` | 核心用户表 |
| 2 | `leaves` | `id` (INT AI) | `user_id`, `leave_type`, `start_time`, `end_time`, `reason`, `status`, `approver_id`, `approval_time`, `approval_notes`, `is_cancelled`, `cancelled_time`, `cancel_time` | 请假 |
| 3 | `notices` | `id` (INT AI) | `title`, `content`, `type`, `priority`, `is_pinned`, `is_todo`, `attachments`(JSON), `creator_id` | 通知 |
| 4 | `notice_reads` | `id` (INT AI) | `notice_id`, `user_id`, `read_time` | UNIQUE(notice_id, user_id) |
| 5 | `notice_completions` | `id` (INT AI) | `notice_id`, `user_id`, `completed_at` | UNIQUE(notice_id, user_id)，待办完成 |
| 6 | `announcements` | `id` (INT AI) | `title`, `content`, `creator_id` | 公告 |
| 7 | `resources` | `id` (INT AI) | `name`, `type`, `url`, `size`, `uploader_id`, `category`, `description` | 资源文件 |
| 8 | `albums` | `id` (INT AI) | `name`, `description`, `creator_id`, `permission` | 相册 |
| 9 | `photos` | `id` (INT AI) | `album_id`, `url`, `description`, `uploader_id`, `is_approved`, `approved_by`, `approved_at` | 照片，需审批 |
| 10 | `messages` | `id` (INT AI) | `content`, `user_id`, `target_id`, `target_type`, `parent_id` | 留言/评论 |
| 11 | `expenses` | `id` (INT AI) | `user_id`, `amount`(DECIMAL 10,2), `type`(收入/支出), `purpose`, `status`, `approver_id`, `approval_step`(0-3), `tier`(small/medium/large), `proof_url`, `details`(JSON), `semester` | 班费收支，三级审批 |
| 12 | `fee_collections` | `id` (INT AI) | `title`, `amount_per_person`, `total_expected`, `collected_amount`, `semester`, `status`(0=收集中,1=已截止,2=已结清), `created_by` | 收缴批次 |
| 13 | `fee_collection_records` | `id` (INT AI) | `collection_id`, `user_id`, `amount`, `paid_at`, `is_exempt`, `remark` | UNIQUE(collection_id, user_id) |
| 14 | `expense_approvals` | `id` (INT AI) | `expense_id`, `step`(1-3), `approver_role`, `approver_id`, `status`(0=待审批,1=已通过,2=已驳回), `notes` | 审批流节点跟踪 |
| 15 | `expense_approval_votes` | `id` (INT AI) | `expense_id`, `user_id`, `vote`(1=同意,2=反对) | UNIQUE(expense_id, user_id) |
| 16 | `fee_publications` | `id` (INT AI) | `title`, `period`(YYYY-MM), `total_income`, `total_expense`, `balance`, `details_json`, `published_by` | 月度公示 |
| 17 | `psychological_applications` | `id` (INT AI) | `user_id`, `content`, `status`, `handler_id`, `handler_notes` | 心理干预申请 |
| 18 | `challenges` | `id` (INT AI) | `name`, `type`, `description`, `current_champion_id` | 擂台主表 |
| 19 | `challenge_applications` | `id` (INT AI) | `challenge_id`, `user_id`, `status`, `approver_id`, `approval_time` | 挑战申请 |
| 20 | `challenge_records` | `id` (INT AI) | `challenge_id`, `challenger_id`, `champion_id`, `result`, `notes` | 挑战记录 |
| 21 | `votes` | `id` (INT AI) | `title`, `description`, `type`, `creator_id`, `start_time`, `end_time`, `is_active`, `visible_scope`, `vote_scope` | 投票 |
| 22 | `vote_options` | `id` (INT AI) | `vote_id`, `content` | 选项 |
| 23 | `vote_records` | `id` (INT AI) | `vote_id`, `user_id`, `option_id` | UNIQUE(vote_id, user_id, option_id) |
| 24 | `homeworks` | `id` (INT AI) | `title`, `description`, `creator_id`, `deadline`, `attachments`(JSON) | 作业 |
| 25 | `homework_submissions` | `id` (INT AI) | `homework_id`, `user_id`, `file_url`, `file_name`, `status`, `score`, `feedback` | 提交记录 |
| 26 | `suggestions` | `id` (INT AI) | `content`, `category`, `status`, `handler_id`, `handler_notes` | 匿名建议 |
| 27 | `lotteries` | `id` (INT AI) | `name`, `description`, `rules`, `creator_id`, `start_time`, `end_time`, `is_active` | 抽奖 |
| 28 | `lottery_participants` | `id` (INT AI) | `lottery_id`, `user_id`, `is_winner`, `prize` | UNIQUE(lottery_id, user_id) |
| 29 | `points` | `id` (INT AI) | `user_id`, `score`, `reason`, `created_by` | 积分(每人多条) |
| 30 | `classes` | `id` (VARCHAR 20) | `name` | 班级，ID 为 manual 字符串 |
| 31 | `operation_logs` | `id` (BIGINT AI) | `user_id`, `action`, `resource_type`, `resource_id`, `method`, `path`, `status_code`, `ip`, `detail`(TEXT) | 操作审计日志 |
| 32 | **VIEW: `user_stats`** | — | `id, name, student_id, class_id, role, leave_count, approved_leave_count, total_points` | 用户统计视图 |
| 33 | **VIEW: `fee_summary`** | — | `total_income, total_expense, balance, pending_small, pending_medium, pending_large` | 班费汇总视图（含待审计数） |

### 2.2 ER 关系要点

- **users** ↔ **leaves**: 1:N (user_id, approver_id)
- **users** ↔ **notices/announcements/albums/homeworks/challenges/votes/lotteries/expenses**: 1:N (creator_id)
- **notices** ↔ **notice_reads**: 1:N (notice_id, user_id) UNIQUE
- **notices** ↔ **notice_completions**: 1:N (notice_id, user_id) UNIQUE（待办）
- **albums** ↔ **photos**: 1:N (album_id)，照片需审批
- **expenses** ↔ **expense_approvals**: 1:N (expense_id) 审批流节点
- **expenses** ↔ **expense_approval_votes**: 1:N (expense_id, user_id) 大额投票
- **fee_collections** ↔ **fee_collection_records**: 1:N (collection_id, user_id) UNIQUE
- **homeworks** ↔ **homework_submissions**: 1:N (homework_id, user_id)
- **votes** ↔ **vote_options** ↔ **vote_records**: 1:N:N
- **lotteries** ↔ **lottery_participants**: 1:N (lottery_id, user_id) UNIQUE
- **messages**: 自引用 (parent_id)

### 2.3 Schema 问题

| 问题 | 说明 |
|------|------|
| ⚠️ `password_hash` 字段 **不在** database_init.sql 中 | 但 AuthController 中大量使用 `user.password_hash` 做 bcrypt 校验，该字段需通过其他脚本或应用代码 ALTER 添加 |
| ⚠️ `users` 表缺少 `password_hash` 列 | 密码登录功能依赖此字段但建表 SQL 中未定义 |
| ⚠️ `expense_approval_votes` 命名与 `votes` 表不一致 | 一个是班费审批投票，一个是通用投票，命名容易混淆 |
| ⚠️ `notices.summary` 字段不存在于建表 SQL 但 NoticeController 更新时尝试写 | updateNotice 方法解构了 summary 字段但表定义中没有 |

---

## 3. Permission Matrix

### 3.1 角色编码（前后端统一）

| 编码 | 常量名 | 中文名 |
|------|--------|--------|
| 0 | `STUDENT` | 学员 |
| 1 | `CLASS_LEADER` | 区队长 |
| 2 | `LIFE_VICE` | 生活副区 |
| 3 | `STUDY_VICE` | 学习副区 |
| 4 | `PSYCHOLOGICAL_VICE` | 心理副区 |
| 5 | `LEAGUE_SECRETARY` | 团支书 |
| 6 | `ORGANIZATION_COMMITTEE` | 组织委员 |
| 7 | `PUBLICITY_COMMITTEE` | 宣传委员 |
| 8 | `SUPER_ADMIN` | 系统管理员 |
| 9 | `COUNSELOR` | 辅导员 |

> 后端 `shared/constants.js` 定义 `ROLES` 对象，前端 `src/constants/roles.ts` 定义 `USER_ROLES` 常量，编码完全对齐。后端通过 `isAdmin()` / `hasRole()` / `hasAnyRole()` 做权限判定，ADMIN_ROLES 包含 1-9。

### 3.2 权限矩阵 (模块化权限模型)

| 权限KEY | 允许的角色 | 说明 |
|---------|-----------|------|
| `ACCESS_DASHBOARD` | 所有干部(1-9) | 班级仪表盘 |
| `PUBLISH_NOTICE` | 所有干部(1-9) | 发布通知 |
| `PUBLISH_ANNOUNCEMENT` | 区队长(1), 管理员(8) | 发布公告 |
| `APPROVE_LEAVE` | 所有干部(1-9) | 审批请假 |
| `COLLECT_FEE` | 生活副区(2), 管理员(8) | 收缴班费 |
| `BOOKKEEP_FEE` | 组织委员(6), 管理员(8) | 记账/公示 |
| `APPROVE_FEE_USE` | 所有干部(1-7), 辅导员(9), 管理员(8) | 审批班费使用 |
| `PUBLISH_HOMEWORK` | 学习副区(3), 管理员(8) | 发布作业 |
| `HANDLE_PSYCHOLOGICAL` | 心理副区(4), 管理员(8) | 处理心理申请 |
| `CREATE_VOTE` | 所有干部(1-9) | 创建投票 |
| `CREATE_LOTTERY` | 所有干部(1-9) | 创建抽奖 |
| `HANDLE_SUGGESTION` | 所有干部(1-9) | 处理建议 |
| `MANAGE_ALBUM` | 所有干部(1-9) | 管理相册 |
| `APPROVE_PHOTO` | 所有干部(1-9) | 审批照片 |
| `UPLOAD_RESOURCE` | 所有干部(1-9) | 上传资源 |

### 3.3 后端子路由级别的角色检查

后端在部分 Controller 方法中还有**细粒度角色检查**（不在前端权限矩阵中）：

| 路由/方法 | 角色要求 | controller |
|-----------|---------|-----------|
| `fee/collections` POST | `ROLES.LIFE_VICE` (2) 或 isAdmin | FeeController.createCollection |
| `fee/collections/:id/exempt` POST | `ROLES.LIFE_VICE` (2) 或 isAdmin | FeeController.exemptCollection |
| `fee/collections/:id/close` POST | `ROLES.LIFE_VICE` (2) 或 isAdmin | FeeController.closeCollection |
| `fee/publications` POST | `ROLES.ORGANIZATION_COMMITTEE` (6) 或 isAdmin | FeeController.createPublication |
| `fee/approvals/:id` POST (审批) | approval_step=1 → 区队长(1)或管理员(8)；step=2 → 辅导员(9)或管理员(8) | FeeController.approveExpense |

---

## 4. API Format Analysis

### 4.1 统一响应格式

**成功响应** (几乎所有 Controller):
```json
{ "success": true, ...data }
```

**错误响应** (几乎所有 Controller):
```json
{ "success": false, "error": "错误信息" }
```

**特殊 HTTP 状态码**:
| 状态码 | 含义 | 响应格式 |
|--------|------|---------|
| 200 | 成功 | `{ "success": true, ... }` |
| 400 | 参数错误/验证失败 | `{ "success": false, "error": "..." }` |
| 401 | 未认证/令牌过期 | `{ "error": "未提供认证令牌" }`（auth middleware） |
| 403 | 权限不足 | `{ "error": "..." }`（auth middleware） |
| 404 | 资源不存在 | `{ "success": false, "error": "..." }` |
| 500 | 服务器错误 | `{ "success": false, "error": "..." }` |

### 4.2 响应格式不一致问题

| 问题 | 描述 | 示例 |
|------|------|------|
| ⚠️ **Auth middleware 返回无 `success` 字段** | 401/403 由 auth.js 直接返回 `{ "error": "..." }`，没有 `success: false` | vs Controllers 返回 `{ "success": false, "error": "..." }` |
| ⚠️ **FeeController 部分错误缺少 `success` 字段** | `createCollection` 的 403 返回 `{ "error": "仅生活副区可发起收缴" }` 缺少 `success` | 与其他 controller 不一致 |
| ⚠️ **成功响应 key 名不统一** | `leaveId` vs `id` vs `noticeId` vs `expenseId` vs `userId` vs 直接数据 | 新增/创建类方法返回的资源 ID key 各不相同 |
| ⚠️ **列表数据 key 名不统一** | `leaves` vs `notices` vs `expenses` vs `albums` vs `photos` | 但大部分已统一为复数名词 |
| ⚠️ **深层数据嵌套方式不一致** | 有的直接 `res.json({ success: true, users })`，有的 `res.json({ success: true, user: {...} })` | 单数/复数混用 |

### 4.3 API 基址和认证方式

- **基址**: 由 `VITE_API_BASE_URL` 环境变量驱动，开发/生产通过 `.env.*` 文件配置
- **认证**: Bearer Token (JWT)，存储在 `localStorage` 中 key 为 `backend_token`
- **请求封装**: `src/utils/request.ts` 基于原生 `fetch`，提供 `get`/`post`/`put`/`del` 方法
- **自动处理**: 401 自动清 token 跳登录页(防循环)、403 抛 PermissionError、4xx/5xx 默认 toast 提示(可通过 `silent` 关闭)

### 4.4 API 路由汇总

完整 API 路由树：

```
/api/auth          → login, cloudbase-login, register, refresh, logout,
                     userinfo, find-by-student, login-with-password,
                     login-with-phone, login-with-email, send-code,
                     phone-code-login, email-code-login, set-password,
                     change-password
/api/users         → GET /, GET /:id, PUT /:id, DELETE /:id
/api/leave         → POST /apply, GET /my, GET /all, GET /:id,
                     PUT /approve, PUT /cancel/:id
/api/notice        → POST /create, GET /, GET /unread/count,
                     GET /todo/count, POST /:id/complete,
                     GET /:id/completion, GET /:id, PUT /:id, DELETE /:id
/api/announcement  → GET /, POST /create, GET /resources,
                     POST /resources, POST /resources/upload,
                     DELETE /resources/:id, GET /:id, DELETE /:id
/api/album         → GET /, POST /, POST /photos, POST /photos/upload,
                     GET /photos/pending, POST /photos/:id/approve,
                     DELETE /photos/:id, GET /:id, DELETE /:id
/api/fee           → POST /collections, GET /collections, GET /collections/:id,
                     GET /collections/:id/records, POST /collections/:id/pay,
                     POST /collections/:id/exempt, POST /collections/:id/close,
                     POST /expenses, GET /expenses/my, GET /expenses,
                     GET /expenses/:id, GET /approvals/pending,
                     POST /approvals/:id, POST /approvals/:id/reject,
                     POST /approvals/:id/vote, GET /approvals/:id/votes,
                     POST /publications, GET /publications, GET /publications/:id,
                     GET /summary, POST /expense, GET /my, GET /all,
                     GET /balance, POST /proof/upload
/api/homework      → GET /pending/count, GET /, POST /, GET /:id,
                     POST /:id/submit, PUT /submission/:submissionId/grade,
                     DELETE /:id
/api/psychological → POST /, GET /mine, GET /all, GET /:id, PUT /:id/handle
/api/challenge     → GET /, POST /, GET /my-applications, GET /:id,
                     POST /:id/apply, PUT /application/:applicationId/approve,
                     POST /:id/record
/api/vote          → GET /, POST /, GET /:id, POST /:id/cast, POST /:id/close
/api/suggestion    → POST /, GET /, GET /mine, GET /:id, POST /:id/handle
/api/lottery       → GET /, POST /, GET /:id, POST /:id/join,
                     POST /:id/draw, PUT /:id/close
/api/points        → GET /mine, GET /ranking, GET /all, POST /
/api/classes       → GET /, POST /
/api/message       → GET /, POST /, DELETE /:id
/api/admin         → GET /members, GET /members/:id, GET /operations
/api/app           → GET /latest
/health            → GET / (健康检查)
```

---

## 5. Key Issues Found

| # | 严重度 | 类别 | 问题描述 |
|---|--------|------|---------|
| 1 | 🔴 **HIGH** | Schema 缺失 | `users` 表缺少 `password_hash` 字段，但 AuthController.loginWithPassword/loginWithPhone/loginWithEmail/setPassword/changePassword 五个方法均依赖 `user.password_hash` 做 bcrypt 比较 |
| 2 | 🟡 **MEDIUM** | API 一致性 | Auth middleware 返回 401/403 时格式为 `{ "error": "..." }` 不含 `success` 字段，而 Controller 层返回 `{ "success": false, "error": "..." }`，前端 request.ts 的 `responseData?.error` 可兼容但不够统一 |
| 3 | 🟡 **MEDIUM** | API 一致性 | FeeController 的部分错误响应（约 15 处）缺少 `success: false` 字段，如 `createCollection` 的 403 返回 `{ "error": "仅生活副区可发起收缴" }` |
| 4 | 🟡 **MEDIUM** | API 一致性 | 成功响应中创建资源的 ID key 不统一: `leaveId`, `noticeId`, `expenseId`, `id` 混用 |
| 5 | 🟡 **MEDIUM** | Schema | `notices.summary` 字段被 NoticeController.updateNotice 解构使用，但建表 SQL 中没有该字段 |
| 6 | 🟡 **MEDIUM** | 安全 | 验证码存储在内存 Map 中（生产环境应换 Redis），`sendCode` 在开发环境直接返回验证码到客户端（有 TODO 标注） |
| 7 | 🟢 **LOW** | 命名 | `expense_approval_votes` 表名与通用 `votes` 表语义接近，命名不够清晰 |
| 8 | 🟢 **LOW** | 前端 | `src/utils/auth.ts` 中 `isAdminRole(role)` 比较的是中文字符串而非后端 INT 编码（已有代码注释标注为 legacy 问题） |
| 9 | 🟢 **LOW** | 文档 | 后端 `shared/constants.js` 中 `COUNSELOR` (9) 仅后端扩展，前端 roles.ts 同样定义了 `COUNSELOR: 9`，但某些前端页面可能未适配 |
| 10 | 🟢 **LOW** | 架构 | 操作日志通过劫持 `res.json` 实现，只能记录被动观察到的响应数据，无法主动获取完整的业务上下文 |
| 11 | 🟢 **LOW** | 配置 | 默认班级数据 (class001~class006) 和默认管理员账号硬编码在 database_init.sql 中 |
| 12 | 🟢 **LOW** | 兼容性 | fee 路由同时保留新旧两套端点：`/expenses`（新）和 `/expense`（旧）、`/expenses/my`（新）和 `/my`（旧）等 |

---

## 6. Frontend Structure Overview

### 6.1 页面清单

| 模块 | 页面路径 |
|------|---------|
| 登录 | `login/password-login`, `login/phone-login`, `login/email-login` |
| 首页 | `index/index` |
| 仪表盘 | `dashboard/index`, `dashboard/notice-completion`, `dashboard/notice-manage` |
| 通知 | `notice/index`, `notice/detail`, `notice/publish` |
| 公告 | `announcement/index`, `announcement/publish`, `announcement/upload` |
| 请假 | `leave/index`, `leave/apply`, `leave/approve`, `leave/detail`, `leave/cancel`, `leave/overview` |
| 班费 | `fee/index`, `fee/apply`, `fee/apply-approve`, `fee/collection`, `fee/publication`, `fee/records`, `fee/reimbursement`, `fee/supervision`, `fee/vote` |
| 作业 | `homework/index`, `homework/detail`, `homework/publish` |
| 心理 | `psychological/index`, `psychological/apply`, `psychological/status` |
| 投票 | `vote/index`, `vote/create`, `vote/detail` |
| 抽奖 | `lottery/index`, `lottery/create`, `lottery/detail` |
| 积分 | `points/index`, `points/rank`, `points/rate` |
| 擂台 | `challenge/index`, `challenge/create`, `challenge/detail` |
| 建议箱 | `suggestion/index`, `suggestion/submit`, `suggestion/status` |
| 相册 | `album/index`, `album/create`, `album/upload` |
| 留言 | — (内嵌在其他页面) |
| 个人中心 | `profile/index`, `profile/settings` |
| 管理员 | `admin/members/index`, `admin/members/detail` |
| 外部 | `external/index`, `external/webview` |

### 6.2 API 封装文件清单 (`src/api/`)

```
auth.ts, user.ts, leave.ts, notice.ts, fee.ts, announcement.ts,
album.ts, suggestion.ts, vote.ts, classes.ts, homework.ts,
psychological.ts, points.ts, challenge.ts, lottery.ts, message.ts
```

### 6.3 核心前端工具/状态

| 文件 | 用途 |
|------|------|
| `stores/user.ts` | Pinia 用户状态管理 |
| `utils/auth.ts` | 认证工具函数 |
| `utils/request.ts` | HTTP 请求封装 (fetch-based) |
| `utils/ui.ts` | UI 工具函数 |
| `utils/avatar.ts` | 头像处理 |
| `utils/index.ts` | 通用工具 |
| `utils/cloudbase.ts` | CloudBase 集成 |
| `utils/update-checker.ts` | App 更新检查 |
| `constants/roles.ts` | 角色/权限常量 |
| `router/index.ts` | 前端路由配置 |
| `composables/useDateTime.ts` | 日期时间组合式函数 |
| `composables/useNoticeUtils.ts` | 通知工具组合式函数 |
| `composables/useRouteGuard.ts` | 路由守卫组合式函数 |
| `composables/useSystemInfo.ts` | 系统信息组合式函数 |
