# 2026-04-19（第二轮） 注册→Store 同步链路打通 + 首页重构

> 本轮的核心痛点：① 注册成功后，姓名/角色/班级没同步到首页与个人中心；② 首页排版可读性差（用户名几乎不可见、统计数据是写死的假数据）。
> 一句话：之前注册只写了一段被 Base64 加密的 `userInfo` 到本地，**完全跳过了后端 `/auth/register` 接口**，也没写 Pinia store，更没拿到 JWT —— 所有需要 token 的 API 全 401。

---

## 1. 根因分析

| 现象 | 根因 |
|------|------|
| 首页头部用户名一片空白 / 显示"学员" | 注册只写到 `uni.setStorageSync('userInfo', encryptedObj)`，没写 Pinia store；首页又用 `JSON.parse` 去解一个本来就是对象（不是字符串）的值，必然失败 |
| 个人中心一片"—" | 同上，profile 页直接读 Pinia store，store 里没东西 |
| 通知列表"暂无通知" + 没有响应 | 没 token → 后端接口 401 → 自动跳回注册页（之前轮的兜底逻辑），形成"看着登录了实际没登录"的死循环 |
| 首页 96% 出勤率 / ¥1,280 等数字 | 写死的 mock，从未接真接口 |

---

## 2. 改动清单

### 2.1 后端 `backend/controllers/AuthController.js`
- 重写 `register`：
  - **直接签发 JWT**（之前只返回 `userId`，前端还得再走一次 login，链路又长又脆）
  - 兼容两种入参形态：`{ openid, userData }`（旧）与扁平 `{ student_id, name, ...}`（新）
  - 内置中文角色名 → INT 的映射表（区队长=1 / 生活副区=2 / …）
  - 学号或 openid 已存在时不报错，**直接复用并签发 token**（注册等价于登录），返回 `reused: true`
  - 新增 `_publicUser(u)` 私有方法统一脱敏返回字段
- 错误信息透传 `error.message`，方便排查

### 2.2 前端 `src/api/auth.ts`
- 新增 `RegisterParams / RegisterResult` 类型
- 新增 `registerAndStoreToken()` —— 调后端 + 自动 `setToken`，与微信端的 `loginAndStoreToken` 对齐

### 2.3 前端 `src/pages/auth/register.vue`
- 移除 `encodeBase64 / setCurrentUser`（旧的本地加密路径）
- 新增 `persistProfileFromBackend(token, user)` 工具：用 `userStore.setTokenAndProfile()` 一次性写 token + profile
- `onSubmit` 改为：
  1. `registerAndStoreToken(...)` 调真后端
  2. 成功 → 写 store → `switchTab` 到首页
  3. 失败 → `uni.showModal` 兜底，让用户清楚看到失败原因，不偷偷往 tab 跳
- `wechatLogin` 链路也接入 `persistProfileFromBackend`，与手动注册保持同一份 store 写入逻辑

### 2.4 前端 `src/pages/index/index.vue`（整页重写）
- **数据源全部接入 Pinia + 真接口**
  - 用户信息：`useUserStore` 的 `profile / displayName / roleLabel`
  - 班费余额：`getBalance()`
  - 我的请假（进行中）：`getMyLeaves()` + `status===1 && !is_cancelled`
  - 未读通知：`getUnreadCount()`
  - 最新动态：`getNotices()` 列表前 5 条
  - 置顶通知：同接口结果中 `is_pinned` 的前 2 条单独展示
- **Hero Card 重排**：
  - 上半区：头像 + 问候语 + 姓名（40rpx 大字粗体） + 角色徽章（实心白底主色）+ 班级胶囊
  - 下半区：当前日期 · 周几 · 学号
  - 渐变 + 装饰圆，用 `box-shadow` 把卡片"浮"起来，姓名再不会被截掉
- **统计卡片**改为 2×2 实用面板（请假 / 未读 / 班费 / 身份），每张可点击跳对应模块
- **快捷入口**扩到 8 个，紧凑 4 列，icon + 名称居中
- **空态卡片**带提示文案
- FAB 仅对 `canPublishNotice()` 为 true 的管理员显示

### 2.5 `src/App.vue`
- `routeGuard` 加固：
  - 已经在 `auth/register` / `auth/login` 页时不再触发跳转，避免 reLaunch 循环

### 2.6 `src/pages/notice/index.vue`
- 空态卡片：图标 + 主标题 + 提示文案（区分"加载中 / 管理员可发布 / 等通知"三种语境）
- 空态从透明背景改成白卡，与整体设计语言一致

---

## 3. 效果对照

| 场景 | 之前 | 现在 |
|------|------|------|
| 手动填写注册并提交 | 本地存一份 base64 → 没有 token → 任何 API 401 → 跳回注册页 | 真调后端 → 签发 JWT → 写 Pinia → 跳首页，所有受保护接口可用 |
| 同学号重复注册 | 后端 400 报错 | 视作登录，直接返回原账号 token（toast：已识别已有账号） |
| 首页头部 | 显示"学员"，名字空白 | 真名 + 角色 + 班级 + 学号，渐变卡片清晰可读 |
| 首页统计 | 96% / ¥1,280 / 2 / 5（mock） | 我的请假 / 未读通知 / 班费余额 / 身份，全部走真接口 |
| 通知列表为空 | 居中一行小灰字"暂无通知" | 白卡 + 图标 + 引导提示，区分加载中/可发布/等通知 |

---

## 4. 测试要点（给手动测试）

1. **手动注册流程**
   - 打开小程序 → 强制跳到注册页
   - 填学号 / 姓名 / 手机 / 邮箱 / 性别 / 政治面貌 / 班级职务 / 班级
   - 不填超级管理员密码 → 注册为学员（role=0），首页应显示"学员"角色徽章
   - 填超级管理员密码 `kskblzdjdwqzkbl` → 出现角色选择 → 选"区队长" → 注册为 role=1，首页"我的身份"应显示"区队长"，且首页右下角出现 + 按钮（发通知）
2. **重复注册**：用同一学号再注册一遍，应提示"已识别已有账号，已登录"，进首页用户信息应一致
3. **同步性**：首页 → 切到"我的" tab，姓名 / 学号 / 班级 / 手机 应与注册时一致
4. **通知**：管理员点首页右下 + → 发布一条通知（带"置顶"开关）→ 返回首页应能看到置顶卡片，"未读通知"统计 +1
5. **请假**：在请假模块申请一条"早操 / 公假" → 通过审批后回首页 → "我的请假"应 +1
6. **退出登录**：个人中心退出 → 应回到注册页，不会卡死

---

## 5. 仍未完成 / 下一轮 backlog

- 班级列表目前只硬编码一个"数据警务技术六区"，PRD 要求班级动态可选 → 需要后端 `/api/classes` 接口
- 政治面貌 / 班级职务 / 学校组织职务 字段目前没入库，仅用于前端展示，DB 里 `users` 表需要加列
- 首页"未读通知"依赖 `/api/notice/unread/count` 接口，若后端未实现需要补
- 首页"班费余额"取的是 `getBalance().balance.balance`，确认后端字段层级一致
- 注册后第一次进首页可能因 token 还在写入流程中，统计卡显示"—"，可考虑首页 `onShow` 主动等待 200ms 再调接口

---

## 6. 受影响文件

### 修改
```
backend/controllers/AuthController.js
src/api/auth.ts
src/App.vue
src/pages/auth/register.vue
src/pages/index/index.vue       （整页重写）
src/pages/notice/index.vue      （空态优化）
```

### 新增
```
docs/devlog/2026-04-19-round2-register-sync-and-home.md
```
