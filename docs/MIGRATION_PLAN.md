# class_mansys 迁移计划 — uni-app → Vue 3 + Vite

> **版本**: v1.0  
> **日期**: 2026-05-17  
> **状态**: 基于架构规范 `SYSTEM_ARCHITECTURE.md` 与双侧代码现状的完整迁移映射  
> **依赖**: 后端 API 不动，前端 API 层（17 模块）全移植 ✅

---

## 目录

1. [差距分析：旧 vs 新 页面映射总表](#1-差距分析旧-vs-新-页面映射总表)
2. [迁移优先级与阶段划分](#2-迁移优先级与阶段划分)
3. [每个待迁移页面的迁移策略](#3-每个待迁移页面的迁移策略)
4. [关键注意事项](#4-关键注意事项)
5. [后端调整建议](#5-后端调整建议)

---

## 1. 差距分析：旧 vs 新 页面映射总表

### 1.1 统计

| 指标 | 数值 |
|------|------|
| 旧 uni-app 页面（.vue） | **58** |
| v2 已存在 | **28**（含 2 个自建页面） |
| 待迁移 | **30**（含 3 个可降级/合并） |
| v2 新增页面 | 3（features、stub/placeholder、dashboard → 管理员重构） |

### 1.2 全量映射

> 图例：✅ 已迁移　❌ 待迁移　❓ 需确认　🔄 重命名/合并　🔷 v2 新增

#### 认证（auth/login）

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 1 | `login/password-login.vue` | `login/password-login.vue` | ✅ | |
| 2 | `login/phone-login.vue` | `login/phone-login.vue` | ✅ | |
| 3 | `login/email-login.vue` | `login/email-login.vue` | ✅ | |

#### 首页

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 4 | `index/index.vue` | `index/index.vue` | ✅ | 功能入口页 |

#### 通知

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 5 | `notice/index.vue` | `notice/index.vue` | ✅ | |
| 6 | `notice/detail.vue` | `notice/detail.vue` | ✅ | |
| 7 | `notice/publish.vue` | — | ❌ | **发布通知**，有权限控制 |

#### 仪表盘/管理员

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 8 | `dashboard/index.vue` | `dashboard/index.vue` | ✅ | |
| 9 | `dashboard/notice-manage.vue` | — | ❌ | 通知完成情况管理（管理员工具） |
| 10 | `dashboard/notice-completion.vue` | — | ❌ | 单条通知的完成详情 |

#### 请假

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 11 | `leave/index.vue` | `leave/index.vue` | ✅ | |
| 12 | `leave/apply.vue` | `leave/apply.vue` | ✅ | |
| 13 | `leave/detail.vue` | `leave/detail.vue` | ✅ | |
| 14 | `leave/approve.vue` | `leave/approvals.vue` | 🔄 | 旧：审批列表；v2 已重写为 approvals |
| 15 | `leave/cancel.vue` | — | ❌ | **销假**页面 |
| 16 | `leave/overview.vue` | — | ❌ | 请假概况（统计看板） |

#### 作业

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 17 | `homework/index.vue` | `homework/index.vue` | ✅ | |
| 18 | `homework/detail.vue` | `homework/detail.vue` | ✅ | |
| 19 | `homework/publish.vue` | — | ❌ | **发布作业**，有权限控制 |

#### 班费（最复杂模块）

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 20 | `fee/index.vue` | `fee/index.vue` | ✅ | |
| 21 | `fee/apply.vue` | `fee/expense-apply.vue` | 🔄 | 旧：费用使用申请；v2 已改名为 expense-apply |
| 22 | `fee/apply-approve.vue` | `fee/approvals.vue` | 🔄 | 旧：申请审批；v2 已合并为 approvals |
| 23 | `fee/collection.vue` | — | ❌ | **班费收缴**（核心页面，复杂状态机） |
| 24 | `fee/records.vue` | — | ❌ | **收支记录**（列表+筛选） |
| 25 | `fee/publication.vue` | — | ❌ | **报销公示**（列表+详情） |
| 26 | `fee/supervision.vue` | — | ❌ | **财务监督**（辅导员视角） |
| 27 | `fee/reimbursement.vue` | — | ❌ | **报销申请**（提交表单） |
| 28 | `fee/vote.vue` | — | ❌ | **投票表决**（>500 元的大额审批投票） |

#### 公告

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 29 | `announcement/index.vue` | `announcement/index.vue` | ✅ | |
| 30 | `announcement/detail.vue` | `announcement/detail.vue` | ✅ | |
| 31 | `announcement/publish.vue` | — | ❌ | **发布公告**，含资源上传 |
| 32 | `announcement/upload.vue` | — | ❌ | 单独的资源上传页（可考虑合并入 publish） |

#### 相册

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 33 | `album/index.vue` | `album/index.vue` | ✅ | |
| 34 | `album/detail.vue` | `album/detail.vue` | ✅ | |
| 35 | `album/create.vue` | — | ❌ | **创建相册** |
| 36 | `album/upload.vue` | — | ❌ | **上传照片** |

#### 投票

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 37 | `vote/index.vue` | `vote/index.vue` | ✅ | |
| 38 | `vote/detail.vue` | `vote/detail.vue` | ✅ | |
| 39 | `vote/create.vue` | — | ❌ | **创建投票** |

#### 抽奖

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 40 | `lottery/index.vue` | `lottery/index.vue` | ✅ | |
| 41 | `lottery/detail.vue` | `lottery/detail.vue` | ✅ | |
| 42 | `lottery/create.vue` | — | ❌ | **创建抽奖** |

#### 擂台

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 43 | `challenge/index.vue` | `challenge/index.vue` | ✅ | |
| 44 | `challenge/detail.vue` | `challenge/detail.vue` | ✅ | |
| 45 | `challenge/create.vue` | — | ❌ | **发起挑战** |

#### 心理

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 46 | `psychological/index.vue` | `psychological/index.vue` | ✅ | |
| 47 | `psychological/apply.vue` | — | ❌ | **申请干预**（敏感页面） |
| 48 | `psychological/status.vue` | — | ❌ | 申请状态查询（学员视角） |

#### 建议

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 49 | `suggestion/index.vue` | `suggestion/index.vue` | ✅ | |
| 50 | `suggestion/submit.vue` | — | ❌ | **提交建议** |
| 51 | `suggestion/status.vue` | — | ❌ | 建议处理状态（提交者查自己的） |
| 52 | — | `suggestion/inbox.vue` | 🔷 | v2 新增：建议接收箱（管理员视角） |

#### 积分

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 53 | `points/index.vue` | `points/index.vue` | ✅ | |
| 54 | `points/rank.vue` | — | ❌ | 积分排行榜 |
| 55 | `points/rate.vue` | — | ❌ | 评分标准说明页（可能是纯展示） |

#### 个人中心

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 56 | `profile/index.vue` | `profile/index.vue` | ✅ | |
| 57 | `profile/settings.vue` | `profile/settings.vue` | ✅ | |

#### 管理员（成员管理）

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 58 | `admin/members/index.vue` | — | ❌ | **成员管理列表**（搜索、筛选、班级切换） |
| 59 | `admin/members/detail.vue` | — | ❌ | 成员详情（个人信息+请假历史+操作日志） |

#### 外部系统

| # | 旧 uni-app | v2 对应 | 状态 | 备注 |
|---|-----------|---------|------|------|
| 60 | `external/index.vue` | — | ❌ | 外部系统入口（教务/图书馆/一卡通等链接） |
| 61 | `external/webview.vue` | — | ❌ | WebView 容器 |

#### v2 新增页面

| # | v2 页面 | 说明 |
|---|--------|------|
| E1 | `features/index.vue` | 🔷 功能矩阵页（全新设计） |
| E2 | `stub/placeholder.vue` | 🔷 占位组件（用于路由占位） |

---

## 2. 迁移优先级与阶段划分

### 2.1 优先级定义

| 优先级 | 含义 | 触发条件 |
|--------|------|---------|
| **P0** | 阻碍核心业务流程，必须迁移 | 日常高频使用（请假/通知/班费）或管理员工具 |
| **P1** | 重要但非高频，二批迁移 | 周期性或特定角色使用（投票/抽奖/擂台创建） |
| **P2** | 低频/辅助功能，最后迁移或降级 | 展示页（排行/评分标准）、可替代页面 |
| **P3** | 可降级/合并/删除 | 简单 WebView、纯展示说明页 |

### 2.2 模块分组与工作量预估

#### Phase B+：P0 — 核心业务闭环（~8 天）

| # | 模块 | 待迁移页 | 复杂度 | 预估 | 说明 |
|---|------|---------|--------|------|------|
| B1 | **notice** | `publish.vue` | 中 | 1.5d | 发布通知表单 + 权限控制 |
| B2 | **homework** | `publish.vue` | 中 | 1d | 发布作业表单 + 文件上传 |
| B3 | **leave** | `cancel.vue`, `overview.vue` | 低 | 1d | 销假（调 API）+ 概况统计 |
| B4 | **fee** | `collection.vue` | **高** | 2d | 收缴批次 + 全班缴纳状态 + 操作交互 |
| B5 | **fee** | `records.vue` | 中 | 1d | 收支记录列表 + 筛选 |
| B6 | **fee** | `apply-approve.vue` → `approvals.vue` | 🔄 | — | v2 已有 `fee/approvals.vue`，需确认功能完整 |
| B7 | **fee** | `vote.vue` | 中 | 1.5d | 大额匿名投票（与普通 vote 不同，内嵌在 fee 模块） |

#### Phase C1：P1 — 管理员工具（~5 天）

| # | 模块 | 待迁移页 | 复杂度 | 预估 | 说明 |
|---|------|---------|--------|------|------|
| C1 | **admin** | `members/index.vue` | 中 | 1.5d | 成员列表 + 班级筛选 + 搜索 |
| C2 | **admin** | `members/detail.vue` | 中 | 1d | 成员详情（含请假历史、操作日志） |
| C3 | **dashboard** | `notice-manage.vue` | 中 | 1d | 通知完成情况管理 Dashboard |
| C4 | **dashboard** | `notice-completion.vue` | 低 | 0.5d | 单条完成详情（可并入 notice-manage） |
| C5 | **fee** | `supervision.vue` | 中 | 1d | 辅导员财务监督视图 |

#### Phase C2：P1 — 创建/发布类页面（~6 天）

| # | 模块 | 待迁移页 | 复杂度 | 预估 | 说明 |
|---|------|---------|--------|------|------|
| C6 | **album** | `create.vue` | 低 | 0.5d | 创建相册（简单表单） |
| C7 | **album** | `upload.vue` | 中 | 1d | 批量上传照片 + 审批流 |
| C8 | **announcement** | `publish.vue` | 中 | 1d | 发布公告 + 资源上传 |
| C9 | **announcement** | `upload.vue` | 低 | 0.5d | 可考虑合并入 publish |
| C10 | **vote** | `create.vue` | 中 | 1d | 创建投票（带选项配置） |
| C11 | **lottery** | `create.vue` | 中 | 1d | 创建抽奖活动 |
| C12 | **challenge** | `create.vue` | 低 | 1d | 发起挑战 |

#### Phase C3：P1 — 提交/申请类页面（~4 天）

| # | 模块 | 待迁移页 | 复杂度 | 预估 | 说明 |
|---|------|---------|--------|------|------|
| C13 | **fee** | `reimbursement.vue` | 中 | 1d | 报销申请表单 |
| C14 | **fee** | `publication.vue` | 中 | 1d | 报销公示列表 |
| C15 | **psychological** | `apply.vue` | 中 | 1d | 心理干预申请（敏感数据） |
| C16 | **psychological** | `status.vue` | 低 | 0.5d | 查看申请状态 |
| C17 | **suggestion** | `submit.vue` | 低 | 0.5d | 提交建议（简单表单） |

#### Phase D：P2/P3 — 辅助/可降级页面（~3 天）

| # | 模块 | 待迁移页 | 复杂度 | 预估 | 说明 |
|---|------|---------|--------|------|------|
| D1 | **points** | `rank.vue` | 低 | 0.5d | 积分排行展示 |
| D2 | **points** | `rate.vue` | 低 | 0.5d | 评分标准说明（可改为纯静态） |
| D3 | **suggestion** | `status.vue` | 低 | 0.5d | 建议处理状态查询 |
| D4 | **external** | `index.vue` | **极低** | 0.5d | 外部系统链接入口（纯展示卡片） |
| D5 | **external** | `webview.vue` | **极低** | 0.5d | WebView 容器（Capacitor 需 `@capacitor/browser`） |

### 2.3 总工作量汇总

| 阶段 | 页面数 | 预估工时 |
|------|--------|---------|
| Phase B+（P0 核心闭合） | 6 | ~8 天 |
| Phase C1（P1 管理员） | 5 | ~5 天 |
| Phase C2（P1 创建/发布） | 7 | ~6 天 |
| Phase C3（P1 提交/申请） | 5 | ~4 天 |
| Phase D（P2/P3 辅助） | 5 | ~3 天 |
| **合计** | **28 页** | **~26 天** |

> 注：与架构文档预估 12-15 天（Phase C）的差异在于首次规划粒度更细，考虑了复杂页面（如 collection.vue 含成员缴纳状态机）的实际工作量。实际推进时可按并行度压缩。

---

## 3. 每个待迁移页面的迁移策略

### 3.1 通用映射规则

所有 uni-app 特有 API 按以下规则替换：

| uni-app API | Vue 3 方案 | 说明 |
|-------------|-----------|------|
| `uni.navigateTo({ url })` | `router.push(path)` | 用 vue-router |
| `uni.redirectTo({ url })` | `router.replace(path)` | |
| `uni.navigateBack()` | `router.back()` / `router.go(-1)` | |
| `uni.reLaunch({ url })` | `router.replace(path)` + 清栈（用 `replace: true`） | |
| `uni.showToast({ title, icon })` | `import { showToast } from '@/utils/ui'` | v2 已封装 |
| `uni.showModal({ content })` | `import { showConfirm } from '@/utils/ui'` | v2 已封装 |
| `uni.showLoading()` / `uni.hideLoading()` | `showLoading()` / v-if loading spinner | |
| `uni.request({ url, method, data })` | `api.xxx(params)` | v2 API 层已全模块封装 |
| `uni.setStorageSync(key, value)` | `localStorage.setItem(key, value)` | 非敏感数据 |
| `uni.getStorageSync(key)` | `localStorage.getItem(key)` | |
| `uni.$emit / uni.$on` | Vue 3 `mitt` 或 Pinia store | 跨组件通信 |
| `uni.previewImage({ urls, current })` | 自建 image-viewer 组件或 v-viewer 库 | |
| `uni.uploadFile({ url, filePath })` | `FormData` + `api.uploadFile(file, onProgress)` | v2 request.ts 应扩展 uploadFile |
| `#ifdef APP-PLUS` | Capacitor `Capacitor.getPlatform() === 'android'` | 条件编译 → 运行时判断 |
| `uni.showActionSheet` | 自建 action-sheet 组件 | |
| `picker` 组件（mode=selector） | `<select>` 或自定义 select 组件 | |
| `rpx` 单位 | CSS `rem`（1rpx ≈ 0.5px，配合 `font-size: 37.5px` html 基础） | 或 postcss-px-to-viewport |

### 3.2 分页策略

#### P0 页面

**notice/publish.vue**（通知发布）
- 复杂度：中
- uni-app 依赖：`<editor>` 富文本（或 `<textarea>`）、`uni.uploadFile`
- 权限：`PUBLISH_NOTICE`（角色 1-9）
- 策略：
  1. 表单：标题 + 内容（textarea/markdown）+ 类型选择（picker → select）+ 完成确认开关
  2. 图片上传：使用 `FormData` + v2 `api` 层的 notice 相关方法
  3. 路由：`router.replace('/pages/notice/index')` 发布成功后跳回列表
- 注意：确认旧 `/api/notice` POST 接口的请求格式（multipart vs JSON）

**homework/publish.vue**（作业发布）
- 复杂度：中
- uni-app 依赖：`uni.uploadFile` 上传作业附件
- 权限：`PUBLISH_HOMEWORK`（角色 3, 8）
- 策略：
  1. 表单：标题 + 描述 + 截止日期（日期选择器）+ 附件上传
  2. 上传同 `notice/publish.vue` 策略
  3. ui 可复用 notice publish 的组件结构

**leave/cancel.vue**（销假）
- 复杂度：低
- API：调用 `leave` 模块的 cancel 端点（确认 `PUT /api/leave/:id/cancel`）
- 策略：
  1. 从路由 query 或 store 获取当前进行中的请假 ID
  2. 调用 `api.leave.cancelLeave(id)` + 确认弹窗
  3. 成功后 toast + 跳回 leave/index

**leave/overview.vue**（请假概况）
- 复杂度：低
- API：调用 `GET /api/leave/all` + 前端统计
- 策略：
  1. 拉取全部请假数据，前端做统计（按状态/人/月份分类）
  2. 简单卡片展示，无复杂交互

**fee/collection.vue**（班费收缴）⚠️ **最复杂页面之一**
- 复杂度：**高** — 全员缴纳状态网格 + 多种操作
- API 端点：
  - `GET /api/fee/collections` — 收缴批次列表
  - `GET /api/fee/collections/:id` — 批次详情
  - `GET /api/fee/collections/:id/records` — 成员缴纳记录
  - `POST /api/fee/collections` — 创建新收缴批次
  - `POST /api/fee/collections/:id/pay` — 缴纳确认
  - `POST /api/fee/collections/:id/exempt` — 免缴
  - `POST /api/fee/collections/:id/close` — 截止收缴
- uni-app 依赖：`<scroll-view>`、`<picker>`、`uni.showModal`
- 权限：`COLLECT_FEE`（角色 2, 8）
- 策略：
  1. **状态机核心**：当前批次状态（active/closed）→ 控制操作按钮显隐
  2. 成员列表：每个成员显示缴纳状态（已缴/未缴/免缴），已缴显示时间
  3. 列表用 v2 已有的 scroll 容器替代 `scroll-view`
  4. 操作交互用 `showConfirm` 二次确认
  5. 进度条用纯 CSS
- 注意：需确认后端 `GET /api/fee/collections` 返回的 records 数据是否包含成员姓名和学号（否则需额外请求 `/admin/members`）

**fee/records.vue**（收支记录）
- 复杂度：中
- API 端点：`GET /api/fee/expenses` + `GET /api/fee/collections`
- 策略：
  1. 双 Tab 切换：收入（收缴批次） / 支出（费用支出）
  2. 列表展示 + 按学期筛选（picker → select）
  3. 可复用已有 `fee/expense-detail.vue` 作为详情跳转

#### P1 管理员页面

**admin/members/index.vue**（成员管理）⚠️
- 复杂度：中
- API：`GET /api/admin/members`（含 query: class_id, keyword）
- uni-app 依赖：`<picker>` 班级选择器、`<input>` 搜索
- 策略：
  1. `<picker mode="selector">` → `<select>` 或自建 dropdown
  2. `@tap` → `@click`
  3. 头像使用 v2 的 `utils/avatar.ts`
  4. 路由跳转到 `/pages/admin/members/detail?id=xxx`

**admin/members/detail.vue**
- 复杂度：中
- API：`GET /api/admin/members/:id`
- 策略：
  1. 个人信息卡片 + 请假历史列表 + 操作日志列表
  2. 编辑模式（`uni.showModal` → `showConfirm` + `showToast`）
  3. 大部分为数据展示，组件化程度高

**dashboard/notice-manage.vue**
- 复杂度：中
- API：`GET /api/notice` + 完成状态聚合
- 策略：
  1. 管理员视角，显示每条通知的完成率统计
  2. 点击进入 `notice-completion.vue` 查看具体完成人

**fee/supervision.vue**（财务监督）
- 复杂度：中
- API：`GET /api/fee/summary`、`GET /api/fee/publications`
- 权限：辅导员（角色 9）+ 管理员（角色 8）
- 策略：
  1. 汇总卡片（总收支、当前余额）+ 近期交易列表
  2. 公示记录入口

#### P1 创建/发布类

**album/create.vue** / **album/upload.vue**
- 策略：表单 + 图片多选上传（input type="file" multiple）
- 注意：旧代码可能依赖云存储 URL（CloudBase），确认当前后端上传机制

**announcement/publish.vue** / **announcement/upload.vue**
- 策略：同 album 模式，考虑合并 publish + upload 为一个页面（Tab 切换）
- API：`POST /api/announcement` + `POST /api/announcement/resources`

**vote/create.vue**
- 策略：标题 + 选项列表（动态添加/删除）+ 截止时间
- API：`POST /api/vote`

**lottery/create.vue**
- 策略：标题 + 奖品配置 + 参与条件
- API：`POST /api/lottery`

**challenge/create.vue**
- 策略：标题 + 挑战类型 + 目标描述
- API：`POST /api/challenge`

#### P1 提交/申请类

**fee/reimbursement.vue**
- 策略：表单（金额+事由+附件上传）+ 提交走班费审批流
- API：`POST /api/fee/expenses`
- 注意：需理解后端费用支出的创建流程（创建即进入审批流）

**fee/publication.vue**
- 策略：列表页，展示已公示的报销记录
- API：`GET /api/fee/publications`

**psychological/apply.vue** ⚠️ **敏感页面**
- 策略：表单（描述+紧急程度）+ 匿名选项
- 注意：心理数据敏感，前端需做输入脱敏提示，后端确认数据隔离

**suggestion/submit.vue**
- 策略：简单表单（标题+内容+类型）
- API：`POST /api/suggestion`

#### P2/P3 辅助页面

**points/rank.vue**
- API：`GET /api/points/ranking`
- 策略：纯展示列表，数据驱动，迁移成本极低

**points/rate.vue**
- 策略：可能是纯静态说明页（评分规则），可直接用 markdown 渲染
- 如果涉及管理端配置，改成动态表单

**suggestion/status.vue**
- 策略：个人建议查询（`GET /api/suggestion/mine`）+ 状态展示

**external/index.vue**
- 策略：纯展示卡片列表，`@tap` → `@click` + `router.push`
- 无 API 调用，迁移最简单

**external/webview.vue**
- uni-app 依赖：`<web-view>` 组件
- **策略**：需引入 `@capacitor/browser` 插件
  ```typescript
  import { Browser } from '@capacitor/browser'
  await Browser.open({ url: 'https://...' })
  ```
  或在 H5 环境用 `window.open(url, '_blank')`
- 如果不需要 Capacitor WebView 内嵌，直接跳转外部浏览器即可

---

## 4. 关键注意事项

### 4.1 复杂页面特别关注

#### 🚨 班费模块（fee）— 系统最复杂业务
- **collection.vue**：含全班成员缴纳状态网格 + 批次创建/关闭/免缴/缴纳四种操作。数据量大（38 人 × 多学期），需关注列表性能。
- **vote.vue**：大额费用（>500 元）匿名投票，数据模型在 `expense_approval_votes` 表，非普通 `votes` 表。API 端点不同。
- **审批流状态机**：小/中/大三种金额阈值对应不同的审批路径，前端需正确展示审批进度条。
- **确认 v2 fee/approvals.vue 是否覆盖旧 apply-approve.vue 全部功能**：审批列表 + 逐条审批 + 投票入口。

#### 🚨 管理员/仪表盘页面
- **dashboard/notice-manage.vue + notice-completion.vue**：这两个页面在旧 pages.json 中没有路由声明，很可能是通过 query 参数或条件渲染从 dashboard/index 切入。需要确定其入口方式。
- **admin/members/index.vue** 使用 `<picker>` 进行班级切换。需确认后端 `/api/admin/members` 的 class_id 参数格式。

#### 🚨 心理干预模块
- 数据敏感度高，迁移时需确认：
  1. 前端是否正确隐藏申请人身份（对非管理员）
  2. 后端 API 是否有相应的数据访问控制

### 4.2 需要统一确认的 API 问题

1. **通知完成确认**：旧 `notice/publish.vue` 有一个「需要完成确认」开关。确认后端 `POST /api/notice` 和 `GET /api/notice/:id/completions` 的字段名一致性。
2. **文件上传端点**：确认当前上传端点是否仍为 CloudBase 云存储格式，或已迁移到本地。
3. **`expense-apply.vue` vs 旧 `apply.vue`**：需要确认 v2 的 fee/expense-apply.vue 是否完全复现了旧 fee/apply.vue 的功能（费用申请单）。
4. **请假 cancel/overview**：确认后端是否有对应的 API 端点（`PUT /api/leave/:id/cancel` 和统计端点）。
5. **external/webview**：确认 Capacitor Android 中是否允许加载 `http://10.1.1.1/`（校内网地址，可能需 `cleartext` 配置）。

### 4.3 样式迁移注意

- 旧 uni-app 大量使用 `rpx` 单位（750rpx = 屏幕宽）。迁移到 v2 时：
  - 推荐方案：`1rpx ≈ 0.5px`，使用 CSS `rem`（基准 `font-size: 37.5px` on `<html>`）
  - 备选方案：引入 `postcss-px-to-viewport`，自动将 `rpx` 转为 `vw`
- 旧代码中 `@import "@/uni.scss"` 需要替换为 v2 的 `@/styles/variables.css`
- `env(safe-area-inset-top)` 等 safe area 在 Capacitor 中仍然有效

### 4.4 路由守卫

v2 的 `router/index.ts` 已有基础 Token 守卫。迁移管理员页面时，需要在路由 `meta` 中添加权限角色：
```typescript
{ path: '/pages/admin/members/index', component: ..., meta: { requiresAdmin: true, roles: [8] } }
```
并在 `beforeEach` 守卫中增加角色校验逻辑。

---

## 5. 后端调整建议

> 原则：后端不动。以下仅列出前端迁移中发现的接口层面的注意项，供后端同学参考。

### 5.1 建议补充的 API 端点

| 端点 | 用途 | 优先级 | 备注 |
|------|------|--------|------|
| `GET /api/leave/stats` | 请假概况统计 | P1 | 或前端自己从 `/api/leave/all` 聚合 |
| `GET /api/fee/collections/:id/records` | 某批次缴纳明细（含用户信息） | P0 | 确认返回是否已包含 `name`, `student_id` |

### 5.2 确认现有 API 行为

| API | 确认项 | 原因 |
|-----|--------|------|
| `POST /api/notice` | 是否已支持 `summary` 字段 | schema 中 `notices` 表缺 `summary`，controller 可能写入 |
| `GET /api/fee/collections` | 是否返回 `records` 或需单独请求 | 旧 collection.vue 可能需要两次请求 |
| `POST /api/fee/collections/:id/pay` | 请求体格式 | 确认是 `{ user_id }` 还是 `{ user_ids: [] }` |
| `POST /api/expenses` | 创建后是否需要单独提交审批 | 理解费用审批流触发机制 |

### 5.3 文件上传适配

如当前上传仍依赖 CloudBase 云存储，则迁移到本地部署后需要新增文件上传 API 端点（或在已有 `/api/resources` 上验证）。

---

## 附录 A：文件树对照

<details>
<summary>旧 uni-app src/pages/ 完整树（点击展开）</summary>

```
src/pages/
├── admin/
│   └── members/
│       ├── index.vue
│       └── detail.vue
├── album/
│   ├── index.vue
│   ├── create.vue
│   └── upload.vue
├── announcement/
│   ├── index.vue
│   ├── publish.vue
│   └── upload.vue
├── challenge/
│   ├── index.vue
│   ├── detail.vue
│   └── create.vue
├── dashboard/
│   ├── index.vue
│   ├── notice-manage.vue
│   └── notice-completion.vue
├── external/
│   ├── index.vue
│   └── webview.vue
├── fee/
│   ├── index.vue
│   ├── collection.vue
│   ├── apply.vue
│   ├── apply-approve.vue
│   ├── vote.vue
│   ├── records.vue
│   ├── publication.vue
│   ├── supervision.vue
│   └── reimbursement.vue
├── homework/
│   ├── index.vue
│   ├── detail.vue
│   └── publish.vue
├── index/
│   └── index.vue
├── leave/
│   ├── index.vue
│   ├── apply.vue
│   ├── approve.vue
│   ├── cancel.vue
│   ├── detail.vue
│   └── overview.vue
├── login/
│   ├── password-login.vue
│   ├── phone-login.vue
│   └── email-login.vue
├── lottery/
│   ├── index.vue
│   ├── detail.vue
│   └── create.vue
├── notice/
│   ├── index.vue
│   ├── detail.vue
│   └── publish.vue
├── points/
│   ├── index.vue
│   ├── rank.vue
│   └── rate.vue
├── profile/
│   ├── index.vue
│   └── settings.vue
├── psychological/
│   ├── index.vue
│   ├── apply.vue
│   └── status.vue
├── suggestion/
│   ├── index.vue
│   ├── submit.vue
│   └── status.vue
└── vote/
    ├── index.vue
    ├── detail.vue
    └── create.vue
```

</details>

<details>
<summary>v2 class-mansys-v2/src/pages/ 完整树（点击展开）</summary>

```
src/pages/
├── album/
│   ├── index.vue
│   └── detail.vue
├── announcement/
│   ├── index.vue
│   └── detail.vue
├── challenge/
│   ├── index.vue
│   └── detail.vue
├── dashboard/
│   └── index.vue
├── features/
│   └── index.vue          ← v2 新增
├── fee/
│   ├── index.vue
│   ├── expense-apply.vue  ← 对应旧 apply.vue
│   ├── expense-detail.vue
│   └── approvals.vue      ← 对应旧 apply-approve.vue
├── homework/
│   ├── index.vue
│   └── detail.vue
├── index/
│   └── index.vue
├── leave/
│   ├── index.vue
│   ├── apply.vue
│   ├── approvals.vue      ← 对应旧 approve.vue
│   └── detail.vue
├── login/
│   ├── password-login.vue
│   ├── phone-login.vue
│   └── email-login.vue
├── lottery/
│   ├── index.vue
│   └── detail.vue
├── notice/
│   ├── index.vue
│   ├── detail.vue
│   └── admin.vue           ← v2 新增（vs 旧 publish.vue / notice-manage）
├── points/
│   └── index.vue
├── profile/
│   ├── index.vue
│   └── settings.vue
├── psychological/
│   └── index.vue
├── stub/
│   └── placeholder.vue     ← v2 新增
├── suggestion/
│   ├── index.vue
│   └── inbox.vue           ← v2 新增
└── vote/
    ├── index.vue
    └── detail.vue
```

</details>

---

## 附录 B：执行检查清单

迁移每个页面时，确认以下步骤：

- [ ] 读取旧 `.vue` 文件，提取 template + script + style
- [ ] 识别所有 `uni.xxx()` API 调用，替换为 v2 方案
- [ ] 替换 `pages.json` 路由跳转为 `router.push/path`
- [ ] 替换 `<picker>` 为 `<select>` 或自建组件
- [ ] 替换 `@tap` → `@click`
- [ ] 替换 SCSS `@import "@/uni.scss"` → v2 `@/styles/variables.css`
- [ ] 替换 `rpx` 单位为 `rem`（1rpx = 0.5px，html font-size: 37.5px）
- [ ] 注册路由到 `router/index.ts`（含 meta 权限）
- [ ] 确认 API 调用使用 v2 `api/` 层方法
- [ ] 确认权限控制（`v-if hasPermission('...')`）
- [ ] 验证页面在 v2 中能正常加载

---

_本文档基于 `SYSTEM_ARCHITECTURE.md`、`old src/pages/`（58 .vue 文件）、`v2 src/pages/`（36 .vue 文件）、`v2 router/index.ts`、`v2 api/`（18 模块）、`old pages.json` 六个数据源撰写。_
