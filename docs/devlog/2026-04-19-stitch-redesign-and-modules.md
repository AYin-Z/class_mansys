# 2026-04-19 Stitch 视觉重构 + 全模块业务接通

> 范围：`leave / notice / announcement / album / suggestion / vote / profile`
> 主题：① 用 Stitch 设计令牌重塑前端视觉；② 把以上模块的前端业务 + 后端接口 + 真实数据全部打通；③ 轻度重构权限/状态层，根治长期存在的权限失效 bug。

---

## 1. 视觉与设计令牌

### 1.1 全局变量
- `src/uni.scss`：替换全部蓝灰色为 Stitch 色板
  - 主色：`#001e40` / `#003366`
  - 表面层级：`#f7f9fc`（页面） / `#f2f4f7`（区块） / `#ffffff`（可点击卡）
  - 文本：`#191c1e`（不用纯黑）/ `#43474f`（次级） / `#c3c6d1`（占位）
- 新增 mixin：`actionable-card`、`section-card`、`hero-gradient`、`accent-bar`、`uppercase-label`、`glass-bar`
- 保留 `glass-effect` 兼容旧组件（`custom-nav-bar` 仍可用）

### 1.2 全局样式
- `src/pages.json`
  - `globalStyle.navigationBarBackgroundColor` → `#ffffff`，`navigationBarTextStyle` → `black`
  - `globalStyle.backgroundColor` → `#f7f9fc`
  - `tabBar.selectedColor` → `#001e40`，`borderStyle` → `white`
  - 重新格式化为多行 JSON，恢复被误删的 `pages/leave/detail` 注册项
- `src/App.vue`
  - `page` 背景色/字体改用 SCSS 变量
  - `.btn-primary` 走 `$gradient-primary`
  - `.input:focus` 边框色走 `$primary`
- `src/components/custom-nav-bar.vue`
  - `@import` 改用 `@/uni.scss` 别名

---

## 2. 状态管理与权限层（轻度重构）

### 2.1 引入 Pinia
- `package.json` 增加 `pinia: ^2.3.1`
- `src/main.ts`
  - `app.use(createPinia())`
  - 全局注册 `custom-nav-bar`

### 2.2 用户 store（单一事实源）
- 新增 `src/stores/user.ts`
  - 状态：`profile / role(数字) / isAuthenticated / isAdmin / displayName / roleLabel`
  - 方法：`hydrate / setProfile / setTokenAndProfile / refresh / logout / hasPermission / isRoleOneOf`
- `src/App.vue` `onLaunch` 调 `userStore.hydrate()` + `routeGuard`：未登录直跳 `/pages/auth/register`

### 2.3 角色与权限矩阵（修关键 bug）
- 新增 `src/constants/roles.ts`
  - `USER_ROLES` 数字枚举（0-8）
  - `ROLE_LABELS` 显示名映射
  - `ADMIN_ROLE_IDS`
  - `PERMISSIONS` 矩阵：`PUBLISH_NOTICE / APPROVE_LEAVE / MANAGE_VOTE / HANDLE_SUGGESTION ...`
  - 工具函数：`isAdmin / hasRole / hasAnyRole / hasPermission / getRoleLabel`
- `src/utils/auth.js` 重写为兼容层
  - 全部权限函数（`isAdmin / canPublishNotice / canApproveLeave ...`）委托到 `roles.ts`
  - 优先从 Pinia store 读用户，回落 localStorage

> 修复点：之前用中文字符串 `'区队长'` 与后端 `INT role` 硬比对，所有权限判断恒为 false，导致管理员功能完全打不开。

### 2.4 网络层
- `src/utils/request.ts`
  - 新增 `ApiError` 类
  - `401` 自动清 token + 跳登录（带 `_redirectingToLogin` 防抖）
  - `403` 直接抛 `ApiError`
  - `silent` 选项：不弹默认 toast
  - `get / post / put / del` 统一改成 `(url, data, opts)` 签名

---

## 3. 后端模块补齐

### 3.1 notice
- `models/Notice.js`
  - `create` 加 `type` 字段与默认值
  - `findById / getAll` `LEFT JOIN users` 取 `creator_name / creator_nickname`
  - 新增 `delete`
- `controllers/NoticeController.js`：`createNotice` 校验 `title/content/type/priority/is_pinned`；`getNoticeDetail` 异步 `markAsRead`；新增 `deleteNotice`
- `routes/notice.js`：新增 `DELETE /api/notice/:id`，并把 `'/unread/count'` 排在 `':id'` 之前

### 3.2 announcement（新建）
- `models/Announcement.js`：`create / findById / getAll`（带 `creator_name`）/ `update / delete`
- `models/Resource.js`：`create / findById / getAll`（按分类过滤 + `uploader_name`）/ `delete`
- `controllers/AnnouncementController.js`：公告与资源全部 CRUD，含 `authorizeAdmin`
- `routes/announcement.js`
  - `GET /api/announcement`、`POST /api/announcement/create`
  - `GET /api/announcement/resources`、`POST /api/announcement/resources`、`DELETE /api/announcement/resources/:id`
  - 公告详情/删除

### 3.3 album（新建）
- `models/Album.js`：`create / findById / getAll`（聚合 `photo_count` + `cover_url`）/ `delete`
- `models/Photo.js`：`create`（`auto_approve` 选项）/ `findById / getByAlbum`（按 `is_approved` 过滤）/ `getPendingPhotos / approve / reject / delete`
- `controllers/AlbumController.js`：上传时自动通过的逻辑 = 管理员 OR 相册创建者
- `routes/album.js`：相册 CRUD + 上传/审批/拒绝

### 3.4 suggestion（新建）
- `models/Suggestion.js`：匿名提交（不存 `user_id`，由前端 localStorage 记 ID）/ `findById / getAll`（含状态、分类过滤）/ `getByIds / handle`
- `controllers/SuggestionController.js`：`submit / listAll(管理员) / listMine / getDetail / handle`
- `routes/suggestion.js`：`POST /` `GET /` `GET /mine` `GET /:id` `POST /:id/handle`

### 3.5 vote（新建）
- `models/Vote.js`：`create`（事务建投票 + 选项）/ `findById / getAll`（含 `creator_name + 参与人数`）/ `getOptions`（含每项票数）/ `getUserChoices / cast`（事务）/ `close`
- `controllers/VoteController.js`：`createVote / listVotes / getVoteDetail / castVote / closeVote`
  - **修复**：种子数据用中文 `单选/多选`，代码原本期望英文 `single/multiple`，现在 `isSingle = vote.type === 'single' || vote.type === '单选'` 双兼容
- `routes/vote.js`：列表/创建/详情/投票/关闭

---

## 4. 前端业务接通

### 4.1 API 层
- 新增：`src/api/announcement.ts / album.ts / suggestion.ts / vote.ts`
- 更新：`src/api/notice.ts` 加 `type / creator_nickname / is_read / deleteNotice`
- `src/api/index.ts` 统一导出

### 4.2 notice
- `pages/notice/index.vue`：`onShow` 自动刷新
- `pages/notice/detail.vue`：接 `getNoticeDetail` + 管理员可见删除按钮（`canPublishNotice`）
- `pages/notice/publish.vue`：新增"通知类型"picker + 置顶开关，提交带 `type / is_pinned`

### 4.3 announcement
- `pages/announcement/index.vue`：双 tab（公告/资源）；FAB 按角色显示（公告 → publish；资源 → upload）；详情弹窗 + 资源 URL 复制
- `pages/announcement/publish.vue`：接 `createAnnouncement`，含必填校验
- `pages/announcement/upload.vue`：CloudBase `uploadFile` 上传 → `createResource` 写库；分类 picker + 文件大小展示；H5 回退 `uni.chooseImage`

### 4.4 album
- `pages/album/index.vue`：接 `getAlbums`，封面取 `cover_url` 否则占位
- `pages/album/create.vue`：接 `createAlbum`
- `pages/album/upload.vue`：拉 `getAlbumDetail` 现有照片，多图上传到 CloudBase 后写库；进度条 + 待审角标；标题动态来自 `albumName`

### 4.5 suggestion
- `pages/suggestion/index.vue`：双 tab（我的/全部，管理员可见）
- `pages/suggestion/submit.vue`：接 `submitSuggestion`，提交后写本地 ID 列表
- `pages/suggestion/status.vue`：接 `getSuggestionDetail` + 处理时间线；管理员处理面板（更新状态/备注 → `handleSuggestion`）

### 4.6 vote
- `pages/vote/index.vue`：接 `getVotes`，状态徽章 `pending/active/ended`；管理员可见"创建投票"
- `pages/vote/detail.vue`：接 `getVoteDetail`，回显选项票数/百分比/我的选择；单/多选投票；管理员可关闭
- `pages/vote/create.vue`：接 `createVote`；起止日期/时间双 picker；选项数 + 时间合法性校验

### 4.7 profile
- `pages/profile/index.vue`：完全接入 Pinia `useUserStore`
  - 头像/昵称/角色徽章/学号/班级/手机/身份均来自 store
  - `onShow` 调 `userStore.refresh()`
  - 退出登录：`cloudbaseLogout()` + `userStore.logout()` → 重置到 `/pages/auth/register`

### 4.8 leave（最后一块）
- `pages/leave/apply.vue`
  - **修复反馈问题"开始/结束时间下拉未完成"**：去掉对 `uni-datetime-picker` 的依赖，改用一行两个原生 `picker mode="date"` + `picker mode="time"` 拼合；结束日期 `start` 自动联动开始日期；保留原 `parseLeaveDateTimeMs` 校验
  - 整页套 Stitch 配色：`hero-strip` 渐变改 `#001e40 → #003366`、`form-card` 去掉描边、`ghost-textarea` 改无边框 + 浅灰底
- `pages/leave/index.vue`
  - `hero-strip / 状态徽章 / accent / 管理员入口` 全部改 Stitch 色
  - 删除 1px 边框，靠卡片 + 左侧色条划分

---

## 5. 修复的关键问题

| # | 问题 | 修复 |
|---|---|---|
| 1 | 权限判断"中文字符串 vs INT role"，所有 admin 功能失效 | `constants/roles.ts` + `auth.js` 兼容层，统一走数字枚举 |
| 2 | 401 后页面卡死 | `request.ts` 自动清 token + 重定向（带防抖） |
| 3 | 用户态散落 `uni.getStorageSync` | 引入 Pinia `useUserStore` 集中托管 |
| 4 | `notice` 缺 `type` 字段 + 没有创建人姓名 | model 加字段 + `LEFT JOIN users` |
| 5 | `announcement / album / suggestion / vote` 仅有占位路由 | 全量补齐 model/controller/route |
| 6 | vote 类型中英不一致（DB 中文/代码英文）导致校验失败 | controller 双兼容判定 |
| 7 | `pages.json` 被 PowerShell 命令误改成单行 `"-NoNewline"` | `git checkout HEAD --` 还原后改回多行可读结构 |
| 8 | leave/apply 起止时间 picker 弹不起来 | 改用原生 `picker mode="date"` + `mode="time"`，去除 `uni-datetime-picker` 依赖 |

---

## 6. 待办（下一轮 backlog）

1. 抽 `backend/constants/roles.js`，把 controller 里 8 处 `[1..8].includes(role)` 改为 `isAdmin(role)`。
2. `fee / auth / admin` 残留页面替换为 Stitch 配色。
3. 列表/轮询接口加 `silent: true`，统一空态/失败态组件。
4. CloudBase 文件 URL 持久化策略（`tempFileURL` 默认 2h 过期，需要按需续签或后端转存）。
5. `useUserStore` 增加响应式 `permission(key)` getter，模板里直接 `v-if="userStore.permission('PUBLISH_NOTICE')"`。
6. `votes.type` 数据库字段统一为英文 enum（`single / multiple`）+ 加约束。

---

## 7. 受影响文件清单

### 新增
```
src/stores/user.ts
src/constants/roles.ts
src/api/announcement.ts
src/api/album.ts
src/api/suggestion.ts
src/api/vote.ts
backend/models/Announcement.js
backend/models/Resource.js
backend/models/Album.js
backend/models/Photo.js
backend/models/Suggestion.js
backend/models/Vote.js
backend/controllers/AnnouncementController.js
backend/controllers/AlbumController.js
backend/controllers/SuggestionController.js
backend/controllers/VoteController.js
backend/routes/announcement.js
backend/routes/album.js
backend/routes/suggestion.js
backend/routes/vote.js
docs/devlog/2026-04-19-stitch-redesign-and-modules.md
```

### 修改
```
src/uni.scss
src/pages.json
src/main.ts
src/App.vue
src/components/custom-nav-bar.vue
src/utils/auth.js
src/utils/request.ts
src/api/index.ts
src/api/notice.ts
src/pages/notice/index.vue
src/pages/notice/detail.vue
src/pages/notice/publish.vue
src/pages/announcement/index.vue
src/pages/announcement/publish.vue
src/pages/announcement/upload.vue
src/pages/album/index.vue
src/pages/album/create.vue
src/pages/album/upload.vue
src/pages/suggestion/index.vue
src/pages/suggestion/submit.vue
src/pages/suggestion/status.vue
src/pages/vote/index.vue
src/pages/vote/detail.vue
src/pages/vote/create.vue
src/pages/profile/index.vue
src/pages/leave/apply.vue
src/pages/leave/index.vue
backend/models/Notice.js
backend/controllers/NoticeController.js
backend/routes/notice.js
package.json
```
