# 前端产品审计报告（2026-09）

> 视角：产品经理 + 交互设计（不是代码质量审计；后端/安全审计见 `AUDIT_2026-09.md`）
> 范围：`frontend-v3`（67 个页面）
> 方法：5 路并行只读审计（导航与信息架构 / 表单与关键流程 / 状态与反馈 / 设计语言 / 新手引导与文案）+ 人工复核关键结论
> 每条结论都可用 file:line 复核；标注「已复核」的条目由本人二次确认过代码
> 局限：纯静态源码推断（无浏览器截图/真机走查），对比度为按令牌值计算的 WCAG 比值；FAB 误触率、返回键行为等需真机复现的问题已标注

## 0. 总览：最该先解决的 12 件事

| # | 问题 | 级别 | 一句话影响 |
|---|---|---|---|
| 1 | toast / 确认框用小程序单位 `rpx`，H5 下样式全部失效（已复核） | P0 | 全站提示都是无内边距无圆角的黑块，所有反馈的载体是坏的 |
| 2 | 请求层无超时、无中止 | P0 | 弱网/断网永久卡在「加载中…」，只能杀 App |
| 3 | 30 处 `catch (_) {}` 把失败吞成空状态，错误重试入口 0/23 | P0 | 用户把「加载失败」读成「班里真没通知」 |
| 4 | 金额/待办失败显示成 0（已复核） | P0 | 干部看到「班费审批 0」「余额 ¥0」，用错数据做判断 |
| 5 | 大额报销投票按钮无在途锁（已复核） | P0 | 双击多记一票，可能推动一笔支出通过 |
| 6 | 班费「免缴」确认函数是死代码 + 手输 user_id（已复核） | P0 | 填错人=把免缴记到别人头上，不可撤销 |
| 7 | 请假驳回用原生 `prompt()` | P0 | Capacitor 壳里可能返回 null → 驳回静默失败，已填意见丢失 |
| 8 | 待办/未读无提醒入口，角标藏在「我的」 | P0 | 学生漏掉「必须标记完成」的待办 |
| 9 | 忘记密码无自助路径，手册却教了验证码登录 | P0 | 忘密学员只能线下找管理员 |
| 10 | 暗色模式冷启动失效（已复核） | P1 | 开了暗色重启又变亮色 |
| 11 | TabBar 高亮映射 key 不存在，15+ 页面永不高亮；FAB 压住 TabBar | P1 | 用户不知道自己在哪；悬浮按钮抢走 tab 点击 |
| 12 | `meta.perm` 从不校验（已复核） | P1 | 手输 URL 就能进管理页 |

## 1. 量化统计（先看数字）

| 指标 | 现状 | 备注 |
|---|---|---|
| 页面总数 | 67 个 `.vue` | 含超管后台 10 个 section |
| 列表页 loading | 21/23 | 但**骨架屏 0/23**，全是「加载中…」文字 |
| 列表页空状态 | 21/23 | 「暂无…」类文案 53 处 |
| **错误态 + 重试** | **0/23** | 仅 2 处有错误文案、无重试按钮 |
| 请求超时 / AbortController | 0 处 | `utils/request.ts` 无 `signal` |
| 空 `catch (_) {}` | 30 处 | 失败被降级成「暂无数据」 |
| 分页 / 「加载更多」 | 0 处 | 列表全部全量返回 |
| `showToast` vs 原生弹窗 | 293 : 14 | alert 4 + confirm 10（`prompt` 1） |
| 「操作失败」零信息量文案 | 27 处 | |
| 服务端权限快照拉取点 | 1 处（`admin/panel.vue:63`） | 其余页面回落到硬编码角色镜像 |
| 死代码 | `composables/useRequest.ts`、`layouts/default.vue`、`style.css`(Vite 模板)、`HelloWorld.vue`、`pages/stub/placeholder.vue`、`confirmExemptUser()` | 见第 6 节 |

## 2. 反馈与状态（P0 集中区）

### 2.1 toast / confirm 样式在 H5 下失效 —— 已复核
`src/utils/ui.ts:27-29,60-62,99-103,112-117` 使用 `rpx`（小程序单位）。浏览器 CSSOM 会**丢弃非法值**，`padding: '20rpx 40rpx'` 全部无效。
**影响**：每条成功/失败提示是无内边距、无圆角、16px 默认字的黑块；确认弹窗排版塌陷。293 处调用共享这个坏载体。
**改法**：`28rpx→14px`、`40rpx→20px`、`24rpx→12px`…整体换 px；补 `white-space: pre-line`（长文案换行）与 `max-width: 80vw`。

### 2.2 请求无超时、无中止 —— P0
`src/utils/request.ts:177` 的 `fetch` 没有 `signal`，全仓 `AbortController` 0 命中。
**影响**：断网/弱网时 `loading` 永远为 true，页面停在「加载中…」；`uploadFile`(`:269`) 与 AI 的 SSE 流同样无法取消。
**改法**：`request()` 内建 `AbortController` + 15s 超时，超时抛 `ApiError('请求超时，请检查网络后重试', 0)`；上传与流式响应支持 abort。

### 2.3 失败被吞成「空状态」 —— P0
30 处 `catch (_) {}`（`notice/index.vue:13-16`+`:29`、`leave/index.vue:23-26`+`:69`、`album/index.vue:11-17`+`:36`、`homework/index.vue:50-53`+`:73`、`vote/index.vue:16`+`:57`…）。
**影响**：5xx/断网时列表渲染「暂无通知 / 暂无记录」，用户当成业务事实，且**没有重试入口**。
**改法**：页面统一三态（loading / error+重试 / empty）；`ApiError.status` 区分网络(0)/5xx/403，文案分别给。`composables/useRequest.ts` 已经写好三态壳子（死代码），改造复用即可。

### 2.4 失败与「真 0」不可区分 —— P0，已复核
`dashboard/index.vue:193-214` 8 个请求全 `.catch(() => null)`，失败后计数保持 0 → 显示「💰 班费审批 0」「📋 待完成任务 0」；`fee/index.vue:76-88` 失败后 `balance = 0` → 「班费余额 ¥0」。
**改法**：失败置 `null`，UI 显示 `--` 或「加载失败，点击重试」，绝不用 0 冒充。

### 2.5 401 处理：静默、状态不同步、误伤登录 —— P1
- `request.ts:194,198` 抛 `silent=true` 的 401，无任何提示直接跳登录；
- `handleAuthFailure`（`:132-139`）只清 localStorage，不清 Pinia；`stores/user.ts:37` 的 `isAuthenticated` 依赖**非响应式**的 `getToken()`，computed 不重算 → `App.vue:35` 的 watch 不触发 → `permissions` 快照残留，管理入口仍可见，点击再次 401，反复横跳；
- `request.ts:192` 未区分 `needAuth`：登录接口密码错误（401）也会走全局登出，把已登录会话清掉。
**改法**：401 → store 一起重置 + 一次「登录已过期」提示；仅 `needAuth` 请求触发登出；登录接口 401 只当业务错误。

### 2.6 其他反馈层问题
| 问题 | 证据 | 级别 |
|---|---|---|
| 页面 catch 的泛化 toast 覆盖后端具体原因（`showToast` 先 remove 再新建） | `ui.ts:13-15` + `leave/apply.vue:144`、`fee/expense-apply.vue:59-60` | P1 |
| 网络错误把英文原文弹给用户（`TypeError: Failed to fetch`） | `request.ts:219-221` | P2 |
| 并发失败连弹 8 次 toast 覆盖彼此 | `dashboard/index.vue:193-201`、`fee/index.vue:75-80` | P2 |
| 登录失败双提示（行内 errorMsg + request 层 toast） | `password-login.vue:33-36` + `request.ts:205` | P2 |
| 组件卸载后 SSE 仍在拉流写状态 | `agent/index.vue:104-107` vs `:132-176` | P2 |
| 详情页不监听 `route.query.id` 变化 | `notice/detail.vue:18-28` 等 4 处 | P2 |
| `challenge/detail.vue:56-59` 提前 return 导致 loading 永真 | `challenge/detail.vue:17,56-59` | P2 |

## 3. 资金与审批安全（最该优先修的业务风险）

| 问题 | 证据 | 级别 |
|---|---|---|
| 大额报销投票按钮无 `:disabled`、`handleVote` 无在途锁（同文件通过/驳回道写对了） | `fee/approvals.vue:129-131`、`:64-76` vs `:97-98` | P0 |
| 免缴：确认函数 `confirmExemptUser` **从未被调用**（已复核）；实际 `doExempt` 无确认无 loading；弹窗要手输内部 `user_id` | `fee/index.vue:130,143-150,300-302` | P0 |
| 请假驳回用原生 `prompt()`，丢弃已填审批意见；干部侧销假无确认 | `leave/approvals.vue:115-117,211,17-29` | P0/P1 |
| 通知/公告/积分记录删除无二次确认（点击即删） | `notice/admin.vue:72-84,146`、`announcement/admin.vue:83,174,198`、`points/manage.vue:86-94,129` | P1 |
| 缴纳班费成功无反馈、失败用 `alert()` | `fee/index.vue:118-127` | P1 |
| 「发起收缴」校验失败静默 return（漏填学期点了没反应，金额可为 0/负） | `fee/index.vue:104-105` | P1 |
| 投票进度条分母用「已投票数」而不是 19 票门槛 → 严重虚高 | `fee/approvals.vue:123` vs `:68,76` | P2 |
| 抽奖详情页一点即开奖（无确认、写死 1 名、失败静默） | `lottery/detail.vue:72-81` | P2 |
| 报销申请页不告知金额分级规则（≤100/100-500/>500 转全员投票） | `fee/expense-apply.vue` + `api/fee.ts:47` | P1 |

## 4. 信息架构与导航

| 问题 | 证据 | 级别 |
|---|---|---|
| TabBar 高亮映射失效：`App.vue:21-32` 返回的 `notice/homework/leave` 三个 key 在 `TabBar.vue:6-12` 里不存在，这些路径也不以任何 tab path 为前缀 → 15+ 页面永不高亮 | `App.vue:21-32`、`TabBar.vue:6-12,41` | P1 |
| `meta.perm` 是死元数据：守卫只判 `requiresAdmin`，11 处 perm 声明从不生效（手输 URL 可进管理页） | `router/index.ts:233` vs `:110,144,156,178-181` | P1 |
| FAB（`fixed;bottom:24px;z-index:50`）压住 TabBar（`z-index:20`）并抢点击，6 个管理页 | `notice/admin.vue:362-376` 等 6 处 vs `TabBar.vue:52-56` | P1 |
| 底部预留不足：`App.vue:66-69` 无 TabBar 高度预留，5 页仅 24px → 末条被遮 | `App.vue:66-69`、`announcement/index.vue:131` 等 | P1 |
| 返回分级不可靠：`NavBar.vue:11-13` 只有 `router.back()`，无 canGoBack/fallback；深链或刷新后点 ‹ 直接退出应用；15 个二级枢纽页仅通知中心有返回 | `NavBar.vue:11-13`、`notice/index.vue:26` | P1 |
| 入口可见性三套口径（仪表盘/全部功能/我的 各说各话），`features/index.vue:39-51` 白名单含 7 个不在数组内的死路径 | `dashboard/index.vue:256`、`features/index.vue:24,39-51`、`profile/index.vue:85-88` | P1 |
| 学员版仪表盘是死代码：路由 `requiresAdmin` + TabBar `adminOnly` → `dashboard/index.vue:299-315` 的学员分支永不可达，学生失去唯一待办汇总页 | `router/index.ts:113`、`TabBar.vue:8`、`dashboard/index.vue:299-315` | P1 |
| 干部高频操作被埋：首页 8 宫格全角色一致、无审批/发布入口；请假页自身无审批入口（手册却写了「请假 → 审批」） | `index/index.vue:105-114`、`leave/index.vue:12,56-65`、`manual.ts:101` | P1 |
| 通知 vs 公告职责重叠（各自 list/detail/admin，首页与仪表盘并列出现）；公告页还塞了公共资源下载 | `router/index.ts:108-110,142-144`、`announcement/index.vue:72-74,124` | P2 |
| 孤儿页/死页：`/pages/psychological/manage` 无任何入口；`features/index.vue:68` 的「即将上线」死分支 | `router/index.ts:156` | P2 |
| 学员页标题叫「管理」 | `leave/index.vue:58`、`homework/index.vue:66`、`fee/index.vue:169` | P2 |

## 5. 新手引导 / 角色差异 / 文案

| 问题 | 证据 | 级别 |
|---|---|---|
| 待办与未读无提醒：首页无角标、TabBar 无通知 tab/角标，唯一角标藏在「我的」；`getUnreadCount`/`getTodoCount` 接口已有却只在不可达页面用 | `index/index.vue:117-134`、`TabBar.vue:6-12`、`api/notice.ts:63,70`、`profile/index.vue:67` | P0 |
| 忘记密码无自助路径，且手册教用户用验证码登录（接口齐全、零调用） | `manual.ts:34,337,339`、`api/auth.ts:86-109`、`router/index.ts:100-102`、`password-login.vue:80-84` | P0 |
| 首次使用零引导，初始密码 123456 只在超管名册导入结果里出现 | `password-login.vue:44-50`、`RosterImportSection.vue:306` | P1 |
| 「全部功能」页对学员渲染灰色管理入口，点击静默无反应（与手册「会直接拦住而不是显示出来却用不了」矛盾） | `features/index.vue:39-56,63-69`、`manual.ts:69` | P1 |
| 空状态普遍无 CTA、筛选为空与真·空不区分 | `leave/index.vue:69`、`notice/index.vue:29`、`homework/index.vue:73`、`fee/index.vue:211,238,257` | P1 |
| 作业提交没有上传入口，要求学员粘贴网盘链接 | `homework/detail.vue:139-140,66-69` | P1 |
| 请假证明材料不在 API 契约里（`as any` 强转），有落库丢失风险 | `leave/apply.vue:136-137`、`api/leave.ts:31-36` | P1 |
| 表单状态无保护：切走/刷新即清空（无 keep-alive、无 onBeforeRouteLeave、无草稿） | 全仓无命中；`leave/apply.vue:12-18`、`fee/expense-apply.vue:11-17` | P1 |
| 擂台申请成功后不刷新「我的申请」，学员以为失败会重复提交 | `challenge/detail.vue:66-76,186-195` | P1 |
| 手册 8 处与界面不符（验证码登录、首页下载 APK、公告入口、请假审批入口、未读角标、辅导员权限…）；MCP 段写死开发机路径 `/home/ayin/...` 与域名、工具数 38/47 | `manual.ts:34,38,41,44,101,115,116,66,309-315` | P2 |
| 辅导员在 UI 显示成「干部(9)」；且 role=9 被放进 `ADMIN_ROLE_IDS`，实际拥有成员管理/名册/积分/投票等权限，与手册描述不符 | `profile/index.vue:38-44`、`roles.ts:22,37,40-50` | P2 |
| 助手示例问题踩权限墙（学员问「中队出勤」）+ 残句「给个建议：」；二次确认卡片无过期信息（手册承诺 5 分钟）；能力清单失败静默显示「0 个模块」 | `agent/index.vue:36,469-477,87-91,523,527-532`、`manual.ts:325` | P2 |
| 「我的」角标把未读通知+待交作业相加挂在「全部功能」上 | `profile/index.vue:46,67,79,105` | P2 |
| 「操作失败」27 处零信息量；请求层兜底文案 `权限不足`/`请求失败 (500)` 直接抛给用户 | `request.ts:201,204,209,219`、`leave/approvals.vue:27,109,129` 等 | P2 |
| 原生 `confirm` 文案不给后果（如批量操作未说明动作、截止批次不带批次名） | `MembersSection.vue:182`、`fee/index.vue:154` | P2 |

## 6. 设计语言与一致性

### 6.1 一句话诊断
**设计令牌层是有的（`styles/variables.css` 115 行，明暗两套），但基本没被使用**：670 个页面文件里 55 个文件、330 处硬编码色值；`components/ui/` 只有 `NavBar.vue` + `TabBar.vue` 两个组件，其余全部各页自己写。结果就是"看起来像一套系统，细节处处不同"。

### 6.2 量化体检

| 维度 | 现状 | 问题 |
|---|---|---|
| 硬编码色值 | **330 处 / 55 文件**（`#fff` 95 次、`#16a34a` 27 次、`#dcfce7` 23 次、`#1a3a5c` 11 次…）+ `rgba()` 79 处 | 令牌被绕过，换肤要改 55 个文件 |
| 同语义多套色 | 成功 `#10b981` vs `#16a34a`/`#dcfce7`（16 文件）；危险 `#ef4444` vs `#e5484d` vs `#ff4d4f`；主色 `#1a3a5c` vs `#2d7ff9` vs `#1a73e8` | 同一状态跨页不同色 |
| 基础组件 | `components/ui` 仅 2 个；自建 Modal 11 文件、Input 样式 21 处、Badge/Tag 26 处、空态 20 种、重写 `.card` 18 处 | 无组件库 |
| "主按钮" | **6 种实现**：高度 42–48px、圆角 6–10px、字号 13–16px、深蓝/亮蓝两种主色 | 用户感知不到"主操作"的一致层级 |
| 数值阶梯 | `font-size` 23 种、`padding` 74 种、`gap` 10 种、圆角字面量 17 种、`line-height` 11 种；`--spacing-*` 定义了 5 个却只被引用 1 次 | 无节奏，视觉杂乱 |
| 未定义令牌 | `--color-danger`（`agent/index.vue:728,797`、`lottery/detail.vue:265`）、`--shadow-card-hover`（`leave/approvals.vue:259`）、`--color-bg-secondary`、`--color-success` fallback | 静默失效（如按下时阴影消失） |
| Fallback 失真 | `var(--radius-md, 12px)` ×25，而真值是 10px | 令牌不可用时尺寸跳变 |
| 对比度（WCAG AA 需 4.5:1） | `--color-text-3 #9ca3af` 白底 **2.54:1**、暗色 **2.22:1**，却被引用 **225 次**且常配 10–11px 字号；`--color-warning` on warning-bg **1.93:1**；白字 on accent 3.81:1 | 次要文字与警告色读不清 |
| 点击区域 | 多处 <44px：`fee/index.vue:385`（≈25px）、`NavBar.vue:39-40`（36px）、`vote/detail.vue:379`（20px） | 手指点不准 |
| 按压反馈 | 60 个有 `@click` 的页面只有 27 个有 `:active`；`:disabled` 绑定 89 处 vs 禁用样式 49 条 | 点了没反馈，以为没点上 |
| 暗色模式覆盖 | 登录三页硬编码 `#fff`+浅色文字，切主题无变化；16 个文件的 `#dcfce7` 徽章暗色下过曝 | 暗色是"半成品" |
| TabBar 避让 | 手写 `padding-bottom`：80px × **39 处**、24px × 5 处 → 末条被 TabBar 压住；导航栏高度有 3 个真源（48/50/57px） | 无统一布局变量 |
| 图标 | **emoji 112 处**（含 TabBar 的 🏠📊🏢🤖👤） | 跨平台字形漂移、无法随主题着色、观感不专业 |
| 屏幕策略 | `App.vue:56-65` 移动壳 480px，`:74-86` 又在 768/1200px 放宽到 900/1100px；断点 6 组散落 | 平板/桌面观感未被设计过 |
| 动效 | 全应用仅 **2 个** `@keyframes`（弹窗、抽屉基本无过渡） | 交互生硬 |
| 死代码 | `src/style.css`（Vite 模板残留：`#aa3bff`、`h1 56px`、`#app 1126px`，**未被打包**）、`layouts/default.vue`（路由未引用，里面恰好藏着缺失的 TabBar 避让 `padding-bottom:64px`）、`HelloWorld.vue`、`pages/stub/placeholder.vue`、`composables/useRequest.ts`、失效的 `@back` 监听 | 维护者容易改错文件 |
| HTML 壳 | `index.html:4-6` 缺 `theme-color`/favicon/apple 标记；`viewport` 用 `user-scalable=no`（禁止缩放） | 装到桌面/浏览器观感与可达性差 |

### 6.3 建议收敛的设计令牌（约 40 个）

```css
/* 颜色（浅色 / 暗色）——括号内为对比度 */
--c-text-1 #1f2937 / #e2e8f0 (14.7:1)
--c-text-2 #4b5563 / #94a3b8 (7.56 / 6.57)
--c-text-3 #6b7280 / #7c8ba1 (4.83 ✓ 替换 #9ca3af 的 2.54)
--c-accent #1d6fe0 / #4d94ff (白字 4.77 ✓ 替换 #2d7ff9 的 3.81)
--c-success #047857 / #34d399 + bg #d1fae5 (4.84 ✓)
--c-warning #b45309 / #fbbf24 + bg #fef3c7 (4.51 ✓ 替换 1.93 的 #f59e0b)
--c-danger  #b91c1c / #f87171 + bg #fee2e2 (5.3 ✓，同时消除 undefined)
--c-overlay rgba(0,0,0,.45) / .6
/* 字号 6 级：20/700 标题、16/600 小标题、14/600 强调、13/400 正文、12/400 辅助、11/500 TabBar */
/* 间距 --sp-1..6 = 4/8/12/16/24/32；页面边距 12、卡内 16、列表间距 8 */
/* 圆角 sm8 / md12 / lg16 / full；阴影 card / lift / modal 三档 */
/* 层级 navbar10 / tabbar20 / sheet40 / modal100 / toast99999；尺寸 --navbar-h48 --tabbar-h56 */
/* 动效 --dur-fast150 --dur-base200 --ease-out cubic-bezier(.2,0,0,1) */
```

### 6.4 落地顺序（设计侧）
1. 修 `utils/ui.ts` 的 `rpx`（与 B1 同一件事）
2. 修 `--color-text-3` / `--color-warning` 对比度 + 补 `--color-danger` 别名
3. 建 `BaseButton / BaseModal / EmptyState / BaseCard / Badge`，先回填 6 处主按钮与 11 处自建弹窗
4. 上 `stylelint color-no-hex`（白名单 `variables.css`）冻结硬编码
5. 字阶/间距/圆角 codemod 收敛 + 删死代码 + TabBar 避让改为 `--tabbar-h` 变量 + emoji 换矢量图标

## 7. 建议的修复批次（按「用户可感知收益 / 风险」排序）

| 批次 | 内容 | 预估 | 收益 |
|---|---|---|---|
| **B1 反馈层地基** | `ui.ts` rpx→px + 长文案换行；`showToast` 去重/不覆盖具体错误；原生 alert/confirm/prompt 全部替换为 `showToast`/`showConfirm`（含后果文案）；顺手修 `--color-text-3`/`--color-warning` 对比度与缺失的 `--color-danger` | 小 | 293 处提示立刻变正常 + 225 处辅助文字可读，投入产出比最高 |
| **B2 网络层三态** | `request.ts` 超时+AbortController；401 区分 `needAuth` + 同步重置 store + 单次提示；网络错误中文化；页面统一 loading/error+重试/empty 三态（复用 `useRequest`）；金额与计数失败显示 `--` | 中 | 断网/弱网不再卡死与误导 |
| **B3 资金与审批安全** | 投票在途锁；免缴改为「按学号/姓名搜索 + 确认弹窗 + loading」；请假驳回改项目内弹窗并提交已填意见；删除类操作二次确认；缴费成功反馈；发起收缴逐字段校验；投票进度条改按 19 票门槛 | 中 | 消除财务与票数错误 |
| **B4 权限与导航** | 路由守卫读 `meta.perm`；TabBar 高亮映射修正（或改为按 tab.path 前缀判定）；FAB 上移避开 TabBar + 底部预留统一；NavBar 返回兜底；三处入口口径统一；`refresh()` 提到 App 启动/首进受保护路由 | 中 | 用户知道自己在哪、权限一致 |
| **B5 提醒与自助** | 首页/TabBar 待办与未读角标；忘记密码入口接通验证码登录/重置密码；首次登录引导；空状态加 CTA 与「筛选为空 vs 真·空」区分 | 中 | 减少客服成本、漏办事项 |
| **B6 设计系统与文案** | 按 §6.3 令牌表收敛颜色/字阶/间距/圆角/层级/动效；建 `components/ui` 基础组件（Button/Card/Modal/Badge/Empty/FormField）并回填 6 处主按钮 + 11 处自建弹窗 + 20 种空态；`--tabbar-h` 统一底部避让（39 处 80px vs 5 处 24px）；emoji 换矢量图标；`stylelint color-no-hex` 冻结硬编码；删死代码（`style.css`/`default.vue`/`HelloWorld.vue`/`useRequest.ts`/`placeholder.vue`）；统一「操作失败」类文案（27 处）；手册 8 处过期内容与写死路径修正 | 大 | 观感与可维护性；后续迭代不再各写一套 |

> 说明：`B1/B2/B3` 属于「用户已经踩到」的问题，建议优先；`B6` 可跟随功能迭代逐步收敛。
