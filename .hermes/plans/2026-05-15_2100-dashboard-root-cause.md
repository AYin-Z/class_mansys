# 仪表盘根因分析与 Vue 3 迁移状态诊断

## 背景

用户反馈：
1. 仪表盘页面频繁出问题（白屏、onShow 残留、loaded 状态、重复 import 编译报错）
2. 询问项目是否已转为纯 Vue 3

## 当前状态总览

### 项目架构（现状）

| 层 | 技术栈 | 备注 |
|---|--------|------|
| 构建 | Vite 5 | ✅ |
| UI 框架 | Vue 3 (Composition API + `<script setup>`) | ✅ |
| 路由 | vue-router (hash history) | ✅ |
| 状态管理 | Pinia | ✅ |
| 原生 | Capacitor (v8.3) | ✅ |
| **uni-app 兼容层** | **@dcloudio/uni-app (aliased)** + **shims/** | **❌** |

### 关键数据

| 指标 | 数值 | 含义 |
|------|------|------|
| `.vue` 文件 | 68 | 55 页面 + 9 公共组件 + 4 其他 |
| `.ts` 文件 | 37 | |
| `uni.*` API 调用（排除 shim 自身） | **477 处** | 分布在所有页面和组件中 |
| uni-app 自定义标签 (`<view>`/`<text>`/`<scroll-view>`/`<image>`) | **1639 处** | 几乎每个 .vue 文件都在用 |
| 从 `@dcloudio/uni-app` 导入生命周期的页面 | **32/68** | 47% 的页面 |
| Vite 兼容插件 | **3 个** | strip-conditional-compile / uni-to-vue / fix-vue-ssr-export |
| uni-ui 组件 | **3 个仍在使用** | UniPopup / UniLoadMore / UniTransition |
| 兼容层代码量 | **541 行** (shims/uni-api.ts) | 覆盖 23 种 uni.* API |

---

## 问题一：项目是否已转为纯 Vue 3？

**结论：没有。项目处于"半迁移"状态。**

运行在 Vue 3 上，但通过一个 **541 行的 uni-app 兼容层** 来支持 477 处 `uni.*` 调用和 1639 处自定义标签。架构图：

```
你的代码（477 处 uni.* + 1639 处 <view>）
    ↕
uni-app 兼容层（541 行 shims + 3 个 Vite 插件）
    ↕
Vue 3 SPA（createApp + vue-router + Pinia + Capacitor）
```

### 兼容层明细

1. **`src/shims/uni-api.ts`** (541 行) — `window.uni` 全局对象，覆盖 23 种 API 类型
   - `navigateTo` / `reLaunch` / `navigateBack` / `redirectTo` → 映射到 vue-router
   - `request` → 基于 XHR 实现
   - `getSystemInfoSync` → 基于 `window` 属性
   - `showToast` / `showModal` → DOM 模拟或 alert
   - `setStorageSync` / `getStorageSync` → localStorage
   - `uploadFile` / `chooseImage` → input 元素
   - 等

2. **`src/shims/uni-lifecycle.ts`** (64 行) — `@dcloudio/uni-app` 别名目标
   - `onLoad` → `onMounted` + `useRoute().query`
   - `onShow` → `onMounted` + `onActivated`
   - `onLaunch` → `onMounted`

3. **Vite 插件** (vite.config.ts)
   - `stripConditionalCompile()` — 删除 `#ifdef`/`#ifndef`/`#endif`
   - `uni-to-vue` — `<view>`→`<div>`, `<text>`→`<span>`, `@tap`→`@click`, `@confirm`→`@keyup.enter`
   - `fix-vue-ssr-export` — 提供 Vue 内部导出（`injectHook`, `logError` 等），满足 `@dcloudio/uni-app` 依赖

### 关于"半迁移"的后果

- **调试困难**：错误栈需要穿越 shim 层 → 原始代码，难以定位
- **性能开销**：每个 `uni.*` 调用都经过 shim 转发，不是直接调用原生 API
- **维护负担**：3 个 Vite 插件增加构建复杂度和出错概率
- **耦合**：移除 uni-app 需要同时改 477 处调用 + 1639 处标签，改造成本极高

### 迁移成本估算

| 子任务 | 估计工作量 | 风险 |
|--------|-----------|------|
| `<view>`→`<div>` (1640 处) | 全局替换，但需逐个确认 | 低 |
| `uni.navigateTo`→`router.push` (数十处) | 逐一替换 | 中 |
| `uni.showToast`/`uni.showModal` → 自定义组件 | 中等 | 低 |
| `uni.request` → fetch (已在 request.ts 中) | 已大部分完成 | 低 |
| `uni.getSystemInfoSync` → `window` API | 低 | 低 |
| `uni.setStorageSync` → localStorage | 低 | 低 |
| 移除 uni-ui 组件 (3 个) | 低 | 低 |
| 移除 3 个 Vite 插件 | 需确认无其他依赖 | 低 |

**总成本：2-3 天。** 但考虑到当前正在快速迭代功能且 APK 已经能正常使用，完全迁移的收益有限。

---

## 问题二：仪表盘为什么问题特别多

### 故障时间线

| 日期 | 提交 | 问题 | 修复方式 |
|------|------|------|----------|
| Day 0 | `6cd5bd5` | 初始创建 | 正常 |
| Day 1 | `227af10` | 提取子页面 |
| Day 1 | `610bafd` | nav-bar 被 title 挡住 | 调 padding |
| Day 1 | `9ef8f8c` | **白屏**（onShow 残留） | 删除残留 `onShow(() => ...)` |
| Day 1 | `b33301f` | 非干部误入 | 加 `onLoad` guard |
| Day 2 | `ea52417` | **白屏**（loaded 未置 true） | 加 loaded 标志 + try-catch |
| Day 2 | `0a65568` | 侧滑退出浏览器 | 加 popstate 拦截 |
| Today | — | **重复 import 编译错误** | 暂态 HMR 问题（已自动修复） |

### 根因分析

**① 分层耦合：onLoad 是"假"的**

仪表盘使用 `import { onLoad } from '@dcloudio/uni-app'`，而它被 vite alias 到 `src/shims/uni-lifecycle.ts`：
```ts
export function onLoad(callback) {
  onMounted(() => {
    callback(useRoute().query || {})
  })
}
```

这本身没毛病，但问题在于：
- 仪表盘是**唯一一个在 `onLoad` 里做权限判断 + loaded 控制渲染的页面**
- 其他 5 个 tab 页面直接渲染，没有 `loaded` 护盾
- 当 `onLoad` 里 `store.isAdmin` 抛出异常（或由于 `hydrate()` 未完成导致短暂为 false），页面要么白屏要么被 redirect

**② 加急功能叠加**

仪表盘是后期加入的 tab（6cd5bd5, 比原 5 个 tab 晚），且功能不断叠加：
- 通知管理入口
- 待办完成追踪
- 权限保护
- 子页面提取
- 统计口径修正

每次加功能都是修"当前症状"，没有重构过底层结构。

**③ 容错路径缺失**

对比其他 tab 页面，仪表盘是唯一一个：
- 依赖 `store.isAdmin` 决定是否渲染
- 依赖后端 API (`getUnreadCount`) 更新徽标
- 在 `onLoad` 里有条件分支逻辑

如果一个守卫失败，整个页面崩溃。其他页面没有这个负担。

**④ 今天的重复 import 错误**

原因是 App.vue 在连续 patch 操作中出现的一次**暂态**：`patch` 工具添加了新 import 但旧 import 还没被移除时，文件系统触发 Vite HMR。Vite 读取到中间状态，报 `Identifier 'Capacitor' has already been declared`。

**文件当前状态正常**（只有一个 Capacitor import），刷新浏览器即可消除。

---

## 建议方案

### 优先级 P0：立即（当前漏洞）

**P0-1 确认重复 import 已消除**
- 运行 `grep -n "import.*Capacitor" src/App.vue` 确认只有一行
- 刷新浏览器，验证仪表盘可正常访问

**P0-2 给仪表盘加渲染护盾**
- 当前已有 `loaded` 标志 + try-catch，但 `onLoad` 作为 `onMounted` 的别名，执行时机晚于模板渲染
- 方案：在 `<script setup>` 顶层先设置 `loaded = true`，然后在 `onLoad` 中按需 redirect
- 这样即使 `onLoad` 出错，页面仍然显示内容（而非白屏）

### 优先级 P1：中期

**P1-1 统一 tab 页面架构**
- 所有 6 个 tab 页面遵循同一模式：直接渲染 + 可选延迟加载
- 消除仪表盘的特判代码

**P1-2 将 onLoad 替换为原生的 onMounted**
- 逐步减少对 `@dcloudio/uni-app` 的依赖
- 将仪表盘的 `onLoad` 改为 `onMounted` + 直接调 `useRoute()`

### 优先级 P2：长期（Vue 3 纯化）

仅当以下条件满足时考虑：
- 功能稳定，迭代放缓
- 有足够时间（2-3 天）做全局替换
- 愿意承受短期内回归风险

- 逐步替换 `uni.*` 调用为原生 Web API
- 替换 `<view>`/`<text>` 为 `<div>`/`<span>`
- 移除 3 个 Vite 兼容插件
- 删除 shims/ 目录

---

## 风险与评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 迁移 Vue 3 期间功能回归 | 高 | 中 | 渐进式替换，每次只改一个模块 |
| 移除 uni-app 后 Capacitor 插件不兼容 | 低 | 高 | Capacitor 已独立于 uni-app，不依赖 |
| 当前架构可继续工作 | — | — | 兼容层稳定运行，非紧急 |

**当前阶段建议：不要做彻底迁移。** 477 处 API 调用 + 1639 处标签替换的成本远大于收益。兼容层比改 2000+ 处代码更安全。

---

## 待下一步

1. 刷新浏览器，确认 P0-1 已修复
2. 实施 P0-2：给仪表盘加模板级渲染护盾
3. 后续功能开发默认使用原生 Vue 3 API（router.push / fetch / localStorage），不再新增 uni.* 调用
