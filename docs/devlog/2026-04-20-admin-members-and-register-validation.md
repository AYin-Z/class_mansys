# 2026-04-20 — 注册报错修复 / 班级补齐 / 注册校验 / 管理员成员后台

## 本轮目标

一次性解决四个相关问题：

1. 真机上提交注册弹窗 `request:fail url not in domain list:class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com`
2. 注册页班级下拉只有五个区队，缺「六区队」
3. 注册信息未做有效性校验，任何字符串都能提交
4. 管理员缺少在后台看成员列表 / 每位成员（请假状态、近期系统内操作）的入口

## 1. 注册报错的根因与对策

这个错不是接口出了问题，而是微信小程序在**真机**上强制校验
`wx.request` 的请求域名是否在 MP 后台白名单里。

- `src/manifest.json` 里的 `"mp-weixin.setting.urlCheck": false` **只对微信开发者工具**
  生效（映射到「详情 → 本地设置 → 不校验合法域名」），一旦用真机预览 / 体验版，
  该设置立即失效，必须把后端域名加进服务器域名白名单。

**解决方式（需管理员在平台操作）：**

- 登录 https://mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名
- 在 `request合法域名` 中加入
  `https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com`
- 一天内最多改 5 次，半小时生效。

**代码侧兜底（本轮已做）：**

- `src/pages/auth/register.vue` 的 `onSubmit` 捕获 `url not in domain list` 错误，
  弹出专门的模态提示，引导用户 / 管理员到 MP 控制台加白名单，而不是误以为后端挂了。

## 2. 班级补齐：六区队

- 前端 fallback 列表（`src/pages/auth/register.vue`）新增 `class006 / 六区队`
- 后端种子脚本 `backend/database_init.sql` 的 `INSERT IGNORE INTO classes`
  加入六区队
- 已部署环境的补丁：`backend/migrations/2026-04-20-admin-members.sql`
  里 `INSERT IGNORE` 六区队 + 建 `operation_logs`

## 3. 注册表单有效性校验

统一在前后端各做一次，前端提升交互、后端做防御。

**前端（`src/pages/auth/register.vue`）**

```js
const STUDENT_ID_RE = /^[A-Za-z0-9]{4,20}$/
const NAME_RE       = /^[\u4e00-\u9fa5A-Za-z·•\s]{2,20}$/
const PHONE_RE      = /^1[3-9]\d{9}$/
const EMAIL_RE      = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
```

- 所有文本字段 `trim`
- 学号 4–20 位字母数字
- 姓名 2–20 位中英文
- 手机号按中国大陆号段校验
- 邮箱基本格式校验
- 新增：性别、政治面貌、班级职务、班级等**必选项**阻断提交
- 已勾选「申请成为管理员」的场景追加管理员角色必选

**后端（`backend/controllers/AuthController.js` register）**

- 同样的正则再跑一遍，400 错误码返回
- 新增 `class_id` 是否存在的校验（存在性通过 `ClassInfo.findById` 检查；查不到时不阻断注册，仅在班级表异常时降级到原逻辑）

## 4. 管理员成员管理后台

### 新增表

`operation_logs`（见 `backend/database_init.sql` & `backend/migrations/2026-04-20-admin-members.sql`）：

```
id, user_id, action, resource_type, resource_id,
method, path, status_code, ip, detail(JSON文本), created_at
```

### 新增中间件

`backend/middleware/operationLog.js`：

- 只拦截 `POST / PUT / DELETE / PATCH` 写操作
- 通过包装 `res.json` 推断是否成功、状态码和响应体摘要
- 自动脱敏 `password / token / secret / superAdminPassword` 字段
- `user_id` 取 `req.user.id`，未登录接口（如 `/api/auth/login`）会记录成匿名

已在 `backend/app.js` 的 `/api` 前缀下全局挂载。

### 新增接口 `/api/admin/*`

- `GET /api/admin/members`
  列表，支持 `class_id / keyword / page / pageSize`，每条返回成员基本信息 + 总请假数 + 当前正在生效请假数 + 最近操作时间。
- `GET /api/admin/members/:id`
  详情，返回成员基本信息 + `active_leave`（当前生效中）+ 最近 10 条请假 + 最近 20 条操作记录 + 聚合 stats（请假数 / 已通过 / 待审批 / 总积分）。
- `GET /api/admin/operations`
  全系统最近操作，可按班级过滤，便于整体巡检。

全部接口均经 `authenticateToken` + `authorizeAdmin` 校验。

### 前端新增页面

- `src/pages/admin/members/index.vue`
  - 成员列表，支持班级筛选 / 姓名学号手机号关键词搜索 / 分页加载更多
  - 状态芯片：`请假中 / 在岗`，副行显示最近操作时间
- `src/pages/admin/members/detail.vue`
  - 基础信息 / 请假状态（含正在生效的请假与聚合数据）/ 最近 10 条请假 / 近期系统内操作
- `src/api/admin.ts` — 三个接口的调用与类型
- `src/pages.json` 注册两条新路由
- `src/pages/profile/index.vue` 在 `isAdminUser` 为真时顶部显示「管理员后台 → 成员管理」入口

## 升级步骤

1. 部署新版后端代码
2. 在 MySQL 上执行 `backend/migrations/2026-04-20-admin-members.sql`
3. 发布新版小程序
4. 一次性动作：在微信公众平台服务器域名白名单里加入 CloudRun 后端 HTTPS 域名

## 后续可做

- 近期操作记录目前按 `action` 自动生成（如 `post:apply / put:approve`），后续可在控制器侧显式 `OperationLog.create` 覆盖，给出更人话的中文事件名
- 成员详情可加「写入点评 / 拉黑 / 强制下线」等管理员动作（需配套接口与审计）
