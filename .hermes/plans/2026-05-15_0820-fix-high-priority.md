# 修复计划：class_mansys 高优问题修复

**编写日期**: 2026-05-15
**来源**: Phases 1-4 全量排查报告
**状态**: 待执行

## 目标

按优先级修复排查中发现的 1 个 Critical + 7 个 HIGH 问题，提升项目健壮性、类型安全和性能。

## 修复列表

### P0 — 路由守卫不触发（Critical）

**问题**: App.vue 的 `routeGuard()` 仅在 `onLaunch` 执行一次。token 过期/手动清除后不重新校验。

**方案**: 将路由守卫挂到 `onShow` + 封装为独立 `composable`，并在 401 拦截后主动触发重定向。

**涉及文件**: `src/App.vue`, `src/utils/request.ts`

**步骤**:
1. 将 `routeGuard` 提取为 `src/composables/useRouteGuard.ts`
2. `App.vue` 的 `onShow` 中调用 `routeGuard()`
3. `src/utils/request.ts` 的 `handleAuthFailure` 中增加 `routerGuard()` 调用（防重入标志已存在）
4. 修复路由匹配：`includes()` → `startsWith()`
5. 修复守卫中的 always-注册页问题：优先跳到最近使用的登录页

---

### P1 — composables 层搭建（HIGH）

**问题**: 项目无 `composables/` 目录，nav-bar + tab-bar 重复 `getSystemInfoSync`，首页纯函数散落。

**方案**: 创建 composables 目录，提取可复用逻辑。

**涉及文件**: 新建 `src/composables/`, `src/components/custom-nav-bar.vue`, `src/components/custom-tab-bar.vue`, `src/pages/index/index.vue`

**步骤**:
1. 创建 `src/composables/` 目录
2. 创建 `src/composables/useSystemInfo.ts`:
   - 提取 nav-bar 和 tab-bar 公共的 `uni.getSystemInfoSync()` 逻辑
   - 返回 `statusBarHeight`, `safeAreaBottom`, `screenWidth`, `screenHeight`
3. 创建 `src/composables/useDateTime.ts`:
   - 提取首页的 `greeting`, `currentDate`, `formatDate`
4. 创建 `src/composables/useNoticeUtils.ts`:
   - 提取 `priorityClass`, `priorityLabel`, `priorityIcon`
5. 更新组件引用，删除重复代码

---

### P2 — 设计系统规范化（HIGH）

**问题**: 仅 5/11 个 Vue 文件导入 SCSS 令牌，其余使用硬编码值。

**方案**: 为未引入 `uni.scss` 的页面添加 `@import "@/uni.scss"`，替换硬编码颜色为令牌变量。

**涉及文件**:
- `src/pages/fee/index.vue`
- `src/pages/notice/index.vue`
- `src/pages/announcement/index.vue`
- `src/pages/login/password-login.vue`
- `src/pages/login/phone-login.vue`
- `src/components/show-captcha.vue`

**步骤**:
1. 为每个文件添加 `@import "@/uni.scss"`（`<style lang="scss">` 块内）
2. 扫描 `fee/index.vue` 中的 `#f7f9fc` → `$surface`, `#001e40` → `$primary`, `#43474f` → `$on-surface-variant`
3. 扫描 `notice/index.vue` 及剩余文件，逐文件替换
4. `show-captcha.vue` 的 `#007aff` → `$primary`, `px` 单位评估是否转为 `rpx`

---

### P3 — `show-captcha` 数据流重构（HIGH）

**问题**: 使用 `uni.$emit/$on` 全局事件总线，违反单向数据流。

**方案**: 改为 `defineEmits` 声明事件，父组件通过 prop + emit 通信。

**涉及文件**: `src/components/show-captcha.vue`, 引用该组件的父页面

**步骤**:
1. 找到所有引用 `show-captcha` 的父组件：`search_files(pattern='show-captcha', path='src/pages')`
2. 重构 `show-captcha.vue`:
   - 用 `defineEmits<{ resolve: [result: CaptchaResult] }>()` 替代 `uni.$emit`
   - 删除 `uni.$on/$off` 监听逻辑
3. 更新父组件使用 `@resolve="handleCaptcha"` 语法

---

### P4 — 缓解首屏阻塞（HIGH）

**问题**: `App.vue` 中 `await initCloudBase()` 阻塞首屏渲染。

**方案**: 将 cloudbase 初始化为分离的非阻塞 Promise，关键操作（hydrate/routeGuard）与其并行。

**涉及文件**: `src/App.vue`, `src/utils/cloudbase.ts`

**步骤**:
1. 将 `initCloudBase()` 改为 fire-and-forget（不 `await`）
2. `hydrate()` 和 `routeGuard()` 改为无依赖并行
3. 需要 cloudbase 的地方（API 请求）自行等待初始化完成
   - `src/utils/request.ts` 中已有重试机制可以兜底

---

### P5 — TypeScript 严格化 + `auth.js` 迁移（HIGH）

**问题**: `tsconfig.json` > `strict: false` + `utils/auth.js` 纯 JS。

**方案**: 开启 `strict: true`，分批修复类型错误；将 `auth.js` 迁移为 `.ts` 或标记为已废弃。

**涉及文件**: `tsconfig.json`, `src/utils/auth.js` (+ 所有引用方)

**步骤**:
1. **不开 `strict: true`**（破坏性太大，会引入上百个类型错误），改为分批推进：
   - 先为未设置 `lang="ts"` 的 3 个组件加上 `lang="ts"`
   - 为 `custom-nav-bar.vue` / `custom-tab-bar.vue` 的 props 添加类型
   - 将 `utils/auth.js` 的 `getCurrentUser` / `setCurrentUser` 先迁移到 `stores/user.ts`
   - 标记 `auth.js` 为已废弃（JSDoc `@deprecated`），逐步移除引用

---

### P6 — 巨型组件拆分（HIGH）

**问题**: `pages/index/index.vue` 647 行，7 个逻辑区块。

**方案**: 拆分为 4 个独立子组件，父组件仅做数据编排。

**涉及文件**: `src/pages/index/index.vue`, 新建 4 个组件

**步骤**:
1. `src/components/home-hero.vue` — 英雄卡片 + 问候语 + 头像
2. `src/components/home-pinned-notices.vue` — 置顶通知
3. `src/components/home-quick-actions.vue` — 快捷功能网格（8 项）
4. `src/components/home-status-cards.vue` — 状态卡片（出勤/作业/班费/请假）
5. `src/components/home-recent-updates.vue` — 最新动态列表
6. `src/pages/index/index.vue` 精简为只做数据加载 + 组件组合

---

## 执行顺序

```
P0 路由守卫       → 最影响用户体验
P1 composables    → 为 P6 拆分提供基础设施
P2 设计系统       → 独立任务，可并行
P3 事件总线       → 中等风险
P4 首屏阻塞       → 高影响面，可先改 App.vue
P5 类型严格化     → 长期任务，先低门槛开始
P6 巨型组件拆分   → 最后，依赖 P1
```

## 文件变更清单

| 文件 | 操作 | 涉及阶段 |
|------|------|---------|
| `src/App.vue` | 修改 | P0, P4 |
| `src/utils/request.ts` | 修改 | P0 |
| `src/composables/useRouteGuard.ts` | 新建 | P0 |
| `src/composables/useSystemInfo.ts` | 新建 | P1 |
| `src/composables/useDateTime.ts` | 新建 | P1 |
| `src/composables/useNoticeUtils.ts` | 新建 | P1 |
| `src/components/custom-nav-bar.vue` | 修改 | P1 |
| `src/components/custom-tab-bar.vue` | 修改 | P1 |
| `src/components/show-captcha.vue` | 修改 | P2, P3 |
| `src/pages/fee/index.vue` | 修改 | P2 |
| `src/pages/notice/index.vue` | 修改 | P2 |
| `src/pages/announcement/index.vue` | 修改 | P2 |
| `src/pages/login/password-login.vue` | 修改 | P2 |
| `src/pages/login/phone-login.vue` | 修改 | P2 |
| `src/utils/auth.js` | 修改 | P5 |
| `src/pages/index/index.vue` | 修改 | P6 |
| `src/components/home-*.vue` | 新建 | P6 |
| `tsconfig.json` | 修改 | P5 |

## 验证

- 每个阶段后执行 `npx uni build --platform h5` 确认构建通过
- 本地 `curl` 验证 H5 页面正常
- 修改 `show-captcha` 后需验证验证码流程
- 修改路由守卫后需验证：未登录重定向、token 过期后重定向

## 风险评估

- **P0** 风险低：`onShow` 已在 App.vue 中注册，添加守卫调用不会影响现有逻辑
- **P3** 风险中：`show-captcha` 的 emit 变更需要确认所有父组件同步更新
- **P5** 风险高：`strict: true` 可能大量报错，建议分阶段推进
- **P6** 风险中：需保留现有功能不变，test 覆盖
