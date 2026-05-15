# 迁移计划：uni-app → Vue 3 + Vite + Capacitor

> 日期：2026-05-15
> 目标：解决 H5 白屏 + 打通 Android APK 打包，保持双端可用

---

## 1. 当前状态快照

### 项目规模
- **源文件**：97 个（`src/`），15,767 行
- **页面**：61 个（含 subPages），8 个公共组件
- **API 模块**：18 个 `src/api/*.ts`
- **后端**：Express + MySQL（CloudBase CloudRun），零改动

### uni-app 依赖图
```
@dcloudio/uni-app          ← 生命周期钩子（onLaunch/onShow/onLoad）
@dcloudio/uni-h5           ← uni.* API 运行时（showToast/navigateTo 等）
@dcloudio/uni-ui           ← uni-popup / uni-load-more / uni-transition 组件
@dcloudio/uni-mp-weixin    ← 微信小程序（已冻结，但作为依赖存在）
@dcloudio/vite-plugin-uni  ← 构建插件（当前白屏根因）
@dcloudio/types            ← 类型声明
@cloudbase/adapter-uni-app ← CloudBase 的 uni-app 适配层
```

### uni.* API 使用盘点
| API | 次数 | 替代方案 |
|-----|------|---------|
| `uni.showToast` | 175 | 自定义 toast 组件（30 行） |
| `uni.hideLoading` | 53 | 统一 loading 管理 |
| `uni.navigateTo` | 37 | `router.push` |
| `uni.showLoading` | 30 | 同上 toast 组件 |
| `uni.showModal` | 21 | 自定义 modal 组件 |
| `uni.navigateBack` | 19 | `router.back()` |
| `uni.reLaunch` | 14 | `router.replace()` |
| `uni.removeStorageSync` | 7 | `localStorage.removeItem` |
| `uni.setStorageSync` | 5 | `localStorage.setItem` |
| `uni.getStorageSync` | 5 | `localStorage.getItem` |
| `uni.chooseMessageFile` | 3 | `<input type="file" multiple>` |
| `uni.chooseImage` | 3 | `<input type="file" accept="image/*">` |
| `uni.uploadFile` | 2 | `fetch`/`axios` multipart |
| `uni.setClipboardData` | 1 | `navigator.clipboard.writeText` |
| `uni.request` | 1 | 由 request.ts 封装，改底层即可 |
| `uni.redirectTo` | 1 | `router.replace` |
| `uni.login` | 1 | 微信小程序专用，已冻结，跳过 |
| `uni.getSystemInfoSync` | 1 | `window` 属性 |
| `uni.getSystemInfo` | 1 | `window` 属性 |

### 条件编译指令
| 文件 | `#ifdef APP-PLUS` | `#ifdef MP-WEIXIN` |
|------|-------------------|-------------------|
| `App.vue` | 启动时检查更新 | - |
| `utils/cloudbase.ts` | App 端签名配置 | - |
| `utils/update-checker.ts` | plus.runtime 更新 | 浏览器端备用方案 |
| `pages/profile/index.vue` | 检查更新入口 | - |
| `pages/auth/register.vue` | - | 微信一键登录 |

### 关键发现（PROJECT_STATUS.md）
> "HBuilderX 云打包在 uni-app CLI + Vite 项目上无法稳定走通，已正式放弃该路径。"
> "新打包路径：引入 Capacitor 8，以 H5 生产构建作为 WebView 资源"

**结论：Capacitor 方案早就定了，但 uni-app H5 构建一直没跑通，所以卡到现在。迁移就是补完最后一步。**

---

## 2. 整体架构（迁移后）

```
┌─────────────────────────────────────────────────┐
│                    src/                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Vue 3    │  │ Pinia    │  │ vue-router    │  │
│  │ 组件     │  │ Store    │  │ 61 个路由     │  │
│  └────┬─────┘  └──────────┘  └───────┬───────┘  │
│       │                              │          │
│  ┌────┴──────────────────────────────┴───────┐  │
│  │  request.ts (axios 替换 uni.request)       │  │
│  │  toast/modal 工具层                        │  │
│  │  CloudBase JS SDK (standard adapter)       │  │
│  └─────────────────┬─────────────────────────┘  │
└────────────────────┼────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │  vite build (dist/)   │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │  Capacitor sync       │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │  Android APK / H5     │
         └───────────────────────┘
```

---

## 3. 迁移步骤（分 4 个 Phase）

### Phase A：基础设施搭建（~2h）

#### A1. 新建 `vite.config.ts`（纯 Vue 3）
- 移除 `uni()` 插件
- 移除所有 workaround 插件（fix-vue-ssr-export, fix-bigint-literals, copy-uni-config, remove-crossorigin, inject-uni-config）
- 添加 `@vitejs/plugin-vue` + `vite-plugin-vue-layouts`（可选）
- 保留 build target `esnext`

**文件**：`vite.config.ts`（完全重写）

#### A2. 更新 `tsconfig.json`
- 移除 `@dcloudio/types` 引用
- 添加 `@vue/runtime-dom` / `vue-router` 类型

#### A3. 更新 package.json
- **卸载**：`@dcloudio/uni-app` `@dcloudio/uni-h5-vite` (via vite-plugin-uni) `@dcloudio/uni-mp-weixin` `@dcloudio/types` `@cloudbase/adapter-uni-app`
- **清空** 6 个 npm script（uni build/dev/cap 命令）
- **添加** npm script：
  ```json
  {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "cap:add": "npx cap add android",
    "cap:sync": "npx cap sync android",
    "cap:open": "npx cap open android",
    "apk": "npm run build && npx cap sync android && npx cap open android"
  }
  ```

#### A4. 添加依赖
```json
{
  "dependencies": {
    "@capacitor/android": "^8.3.1",  // 已有
    "@capacitor/cli": "^8.3.1",      // 已有
    "@capacitor/core": "^8.3.1",     // 已有
    "vue": "^3.4.21",                // 已有
    "vue-router": "^4.3.0",          // 新增
    "pinia": "^2.2.0",               // 已有
    "@cloudbase/js-sdk": "^3.3.3",   // 已有
    "axios": "^1.6.0",               // 已有（后端在用，前端加一份）
    "@dcloudio/uni-ui": "^1.5.12"    // 保留 — 纯 Vue 组件可独立使用
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",  // 新增，替代 uni()
    "vite": "5.2.8",                 // 已有
    "sass": "^1.62.1",              // 已有
    "typescript": "^5.4.0",
    "vue-tsc": "^2.0.0"
  }
}
```

#### A5. 更新 `capacitor.config.ts`
- `webDir`：`'dist/build/h5'` → `'dist'`（标准 Vite 输出）

**文件**：`capacitor.config.ts`

---

### Phase B：核心架构改造（~4h）

#### B1. vue-router 配置
- 读取 `src/pages.json` 中的 61 个页面路径
- 生成 `src/router/index.ts`（包含全量路由 + 嵌套路由支持）
- 首页 `/pages/index/index` → `/`（alias）
- 未登录/未注册重定向中间件

```ts
// router/index.ts 核心结构
const routes = [
  { path: '/', redirect: '/pages/index/index' },
  { path: '/pages/index/index', component: () => import('@/pages/index/index.vue') },
  { path: '/pages/login/password-login', component: () => import('@/pages/login/password-login.vue') },
  // ... 61 个
]
```

**新建**：`src/router/index.ts`

#### B2. 重写 `main.ts`
- 移除 `import { plugin as uniPlugin, uni } from "@dcloudio/uni-h5"`
- 移除 `import showCaptcha from "./components/show-captcha.vue"` 等全局注册
- 改为标准 Vue 3 模式：

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// uni-ui 组件如果不走 easycom，需手动注册（与当前 main.ts 一致）
app.component("uni-popup", UniPopup)
// ...

app.mount('#app')
```

**文件**：`src/main.ts`

#### B3. 重写 `request.ts`
- `uni.request` → `axios` 实例
- `uni.getStorageSync` → `localStorage.getItem`
- `uni.setStorageSync` → `localStorage.setItem`
- `uni.removeStorageSync` → `localStorage.removeItem`
- `uni.reLaunch` → `router.replace`
- `uni.showToast` → 直接调用 toast 工具（Phase C 的产物）
- 保留所有业务逻辑：JWT 注入、401 处理、401 拦截回调

**文件**：`src/utils/request.ts`

#### B4. 更新 `App.vue`
- `import { onLaunch, onShow, onHide } from "@dcloudio/uni-app"` → `import { onMounted, onUnmounted } from 'vue'`
- `onLaunch` → `onMounted`（首次挂载）
- `onShow` → `document.addEventListener('visibilitychange', ...)` + 路由 afterEach 守卫
- `onHide` → `document.removeEventListener(...)`
- `#ifdef APP-PLUS` 块 → `if (/* Capacitor 平台检测 */)` 条件
- 移除 `page` 选择器（uni-app 内置），改为 `body` / `#app`

**文件**：`src/App.vue`

#### B5. 更新 CloudBase 适配
- `@cloudbase/adapter-uni-app` → `@cloudbase/js-sdk` 标准 web 适配器
- 移除 `cloudbase.useAdapters(adapter, { uni: uni })`
- `#ifdef APP-PLUS` 块 → 运行时检测 `navigator.userAgent` 或 Capacitor API

**文件**：`src/utils/cloudbase.ts`

---

### Phase C：API 替换层 & 工具函数（~3h）

#### C1. 通用 UI 组件
创建 `src/utils/toast.ts`（替代 175 处 `uni.showToast`）：
```ts
// toast 实现：用 position fixed + transition
export function toast(msg: string, opts?: { icon?: string; duration?: number }) {
  // 创建一个临时 div，显示后自动消除
}
```

创建 `src/utils/modal.ts`（替代 21 处 `uni.showModal`）：
```ts
export function confirm(msg: string): Promise<boolean> {
  // 返回 Promise<boolean> 的弹窗
}
```

创建 `src/utils/loading.ts`（替代 53+30 处 `showLoading/hideLoading`）：
```ts
export function showLoading(msg?: string) { ... }
export function hideLoading() { ... }
```

#### C2. 全局注册
在 `main.ts` 中挂载到 `app.config.globalProperties.$toast`，或逐个替换 import。

**关键决策：逐个替换 vs 全局 polyfill**
→ 建议**逐个替换**（虽然后者快，但 polyfill 在 App 端可能有未知行为）
→ 但注册一个 `$showToast = toast` 等全局属性可以减少改动量

#### C3. 导航替换
- `uni.navigateTo({ url })` → `router.push(url)`
- `uni.navigateBack()` → `router.back()`
- `uni.reLaunch({ url })` → `router.replace(url)` + 重置 history
- `uni.redirectTo({ url })` → `router.replace(url)`

#### C4. 文件/媒体
- `uni.chooseImage` → `<input type="file" accept="image/*">` 封装
- `uni.chooseMessageFile` → `<input type="file" multiple>`
- `uni.uploadFile` → `axios.post` + FormData

#### C5. Remaining uni.*
- `uni.getSystemInfoSync` → `{ windowWidth: window.innerWidth, ... }`
- `uni.setClipboardData` → `navigator.clipboard.writeText`
- `uni.getSystemInfo` → `window` 属性

---

### Phase D：页面逐个适配（~6h）

#### D1. 生命周期钩子替换
约 25 个页面使用 `@dcloudio/uni-app` 的 `onLoad` / `onShow`：
- `onLoad` → `onMounted`（页面挂载时执行，参数从 router query 获取）
- `onShow` → `onMounted` 或 `onActivated`（如需 keep-alive）

**操作模式**：批量替换后逐个页面验证编译不报错。

#### D2. 样式适配
- `uni.scss` 中的 `rpx` 单位：`750rpx = 100vw`，等价于 `1rpx = 0.1333vw`
  - 方案 A：保留 rpx，用 PostCSS 插件 `postcss-px-to-viewport` 将 `rpx` 转为 `vw`
  - 方案 B：全局用 SCSS 函数 `@function rpx($px) { @return calc($px / 750 * 100vw) }`
  - **推荐方案 A**：`postcss-px-to-viewport-8-plugin`，成本最低

- `page` 选择器 → `body` / `#app`
- `rpx` 在组件中的硬编码 → postcss 自动转换

#### D3. 条件编译处理
| `#ifdef` 位置 | 替换方案 |
|---------------|---------|
| App.vue: `checkAppUpdate` | `navigator.userAgent.includes('Capacitor')` 检查 |
| cloudbase.ts: App 签名 | 移除，H5 不需要签名，App 端用 Capacitor 插件 |
| update-checker.ts: `plus.runtime` | 用 Capacitor `App` 插件替代 |
| profile/index.vue: 更新入口 | `Capacitor.getPlatform() === 'android'` 时显示 |
| register.vue: 微信登录 | 移除（小程序已冻结） |

#### D4. uni-ui 组件处理
- `uni-popup` / `uni-load-more` / `uni-transition` 保留 npm 包（纯 Vue 组件，不依赖 uni-app 运行时）
- `show-captcha.vue` 保留（已经是普通 Vue 组件）
- `custom-nav-bar.vue` 保留（已经是普通 Vue 组件）

#### D5. SCSS 变量兼容
- `uni.scss` 中的 `$uni-opacity-disabled` 等变量 → 替换为项目自定义变量
- 其他 `$primary` / `$surface` 等 SCSS 变量保留不变

---

## 4. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `vite.config.ts` | 🔄 重写 | 移除 uni()，添加 @vitejs/plugin-vue |
| `src/main.ts` | 🔄 重写 | 标准 Vue 3 入口 |
| `src/App.vue` | 🔄 改造 | uni-app 生命周期→Vue 生命周期 |
| `src/router/index.ts` | ✨ 新建 | vue-router 全量路由 |
| `src/utils/request.ts` | 🔄 重写 | uni.request → axios |
| `src/utils/cloudbase.ts` | 🔄 改造 | 移除 uni-app 适配器 |
| `src/utils/toast.ts` | ✨ 新建 | Toast 工具函数 |
| `src/utils/modal.ts` | ✨ 新建 | 确认弹窗工具函数 |
| `src/utils/loading.ts` | ✨ 新建 | Loading 工具函数 |
| `capacitor.config.ts` | 🔧 修改 | webDir: 'dist/build/h5' → 'dist' |
| `package.json` | 🔧 修改 | dependencies + scripts |
| `tsconfig.json` | 🔧 修改 | 移除 uni-app 类型 |
| `.env.*` | ⚠️ 检查 | CloudBase adapter 变更后 env 变量 |
| `src/uni.scss` | 🔧 修改 | 清理 uni-app 特有变量 |
| `index.html` | 🔧 修改 | 添加 `<div id="app">` |
| `src/pages.json` | 🗑️ 保留 | 仅作路由参考，不再被构建使用 |
| `src/manifest.json` | 🗑️ 保留 | 同上 |
| `src/pages/*.vue`（25+ 页） | 🔧 批量改 | onLoad→onMounted, onShow→onMounted |
| `src/pages/*.vue`（全部 61 页） | 🔧 批量改 | uni.* → 工具函数替换 |

---

## 5. 执行顺序

```
Phase A ──→ Phase B ──→ Phase C ──→ Phase D
(基础)       (架构)       (工具)       (页面)

推荐切分：
Day 1: A1-A5 + B1-B2    → 能编译出空白页
Day 2: B3-B5 + C1-C3    → 页面能渲染 + API 通
Day 3: C4-C5 + D1-D3    → 页面功能恢复
Day 4: D4-D5 + 全量回归  → 修复 bug + 跑通 APK
```

---

## 6. 验证方法

### 每步验证
- `npm run dev` 启动 Vite dev server
- 浏览器打开，检查控制台无报错
- 页面渲染正常，路由跳转正常

### 全量回归清单
1. 首页加载显示 ✅
2. 密码登录/OTP 登录 ✅
3. 请假流程（申请→审批→销假）✅
4. 班费流程（收缴→使用申请→审批→公示）✅
5. 通知公告发布与阅读 ✅
6. 投票创建与参与 ✅
7. 积分展示 ✅
8. 相册上传与查看 ✅
9. 抽奖创建与参与 ✅
10. 挑战创建与参与 ✅
11. 心理干预申请与处理 ✅
12. 作业发布与提交 ✅
13. 意见箱提交 ✅
14. 成员管理 ✅

### APK 验证
```bash
npm run build           # 构建前端
npx cap sync android    # 同步到原生项目
npx cap open android    # Android Studio 打开
# Build → Build APK(s)  # Android Studio 操作
```

---

## 7. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| `rpx` 单位导致样式错乱 | 中 | 高 | PostCSS 插件处理，或替换为 rem/vw |
| `uni-ui` 组件内部依赖 uni-app 运行时 | 低 | 中 | 如果不能用，替换为轻量 Vue 组件 |
| CloudBase web adapter 行为差异 | 低 | 高 | 先验证登录流程是否正常 |
| Capacitor 8 环境不满足（JDK/Gradle） | 中 | 中 | 本地开发机需要安装，不是代码问题 |
| 迁移后遗漏某些 uni.* API | 低 | 中 | TypeScript 编译会报未找到的调用 |
| 61 个页面回归耗时 | 确定 | - | 分批验证，先跑通核心流程 |

---

## 8. 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 是否保留 `uni-ui` | ✅ 保留 | 纯 Vue 组件，不依赖 uni-app 运行时 |
| `rpx` 单位处理 | PostCSS 插件 | 改动最小，不修改源文件 |
| 替换策略 | 逐个替换 uni.* 调用 | 避免全局 polyfill 的未知副作用 |
| `onShow` → 什么 | `onMounted` + 路由守卫 | 功能对等，更符合标准 Vue 模式 |
| 微信小程序代码 | 保留不删 | `#ifdef` 块改为条件语句后不执行即可 |
| 全局 toast/modal/loading | 导出独立函数 | 不使用全局属性，减少耦合 |
