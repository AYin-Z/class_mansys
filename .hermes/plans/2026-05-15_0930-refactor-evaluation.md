# H5 白屏评估报告与行动方案

## 当前状态 & 根因分析

### 已修复
| 问题 | 状态 | 方式 |
|------|------|------|
| `uni is not defined` | ✅ | `main.ts`: `(window as any).uni = uni` |
| `__uniConfig is not defined` | ✅ | `renderChunk` 注入简化版 config |
| `__uniRoutes` 未定义 | ✅ | 同上 |
| 隧道路由丢失 | ✅ | 恢复 config.yml |

### 仍白屏的原因

诊断产物 `index-DZYl22GK.js` 确认：
- `window.__uniConfig = e` ✓
- `window.__uniRoutes = t` ✓
- `window.uni = D_` ✓
- **`setupPage`** ✗ — 不存在
- **`PageComponent`** ✗ — 不存在
- **`renderPage`** ✗ — 不存在
- **`import.meta.glob`** ✗ — 不存在
- Routes 中 `component: null`, `loader: null` — **uni-app 路由器无法渲染**

**根因**：`@dcloudio/uni-h5-vite` 的插件链生成页面 loader、路由注册、CSS 导入等代码，但这个插件链从 `main.ts` 变换开始就有问题（我们加了 debug 日志，filter 命中但 transform 内部的代码不执行——插件系统未被正常调用，非 tree-shaking 问题）。`renderChunk` 注入的 config 是**空壳**，缺少 55 个页面的动态 import loader、setupPage 调用、renderPage 组件 setup。

### 项目规模

- 97 个源文件，15,767 行代码
- 55 个页面，8 个组件
- `uni.*` API 调用约 300+ 处（showToast/navigateTo/showModal/chooseImage 等）
- 依赖：uni-app, uni-ui, Pinia, Vue 3, cloudbase, capacitor

---

## 三条路线对比

### 路线 A：生成 pages-json-js 实体文件（推荐）

**思路**：`uni:h5-pages-json` 插件应该生成的 JS 代码，我们手动写一个脚本生成它，存为实体文件，由 `main.ts` 直接导入。绕过整个虚拟模块插件链。

**工作量**：中等（半天）
- 写脚本读取 `pages.json` + `manifest.json`，输出 `src/.gen/pages-json-js.ts`
- 包含：55 个页面的 `setupPage` 动态 import loader、`renderPage` 路由组件、`window.__uniConfig`/`__uniRoutes`、CSS import
- 删除 `renderChunk` 注入插件
- 重新构建 + 验证

**优点**：
- 不改动业务代码
- 保留 uni-app 生态（后续微信小程序、App 打包照常）
- 插件链不工作了，我们就自己生成它该做的事

**风险**：
- 生成的代码可能遗漏某些细节（layout、tabBar、i18n 等——本项目无 tabBar，layout 默认，可接受）
- DCloud 升级版本后生成逻辑可能需要对齐

### 路线 B：尝试 dev 模式 + 报告 DCloud（诊断性）

**思路**：先用 `npm run dev:h5` 看看开发模式能否正常工作。如果 dev 模式可以，说明是 Rollup 构建阶段的问题，可在 dev 模式下临时访问 H5。

**工作量**：小（1 小时）
- 启动 dev server
- 用浏览器访问验证
- 如果可用，作为临时方案

**风险**：
- dev 模式可能同样有问题（同样的插件链）
- dev 模式无法用于生产部署
- 依赖 Vite dev server 长期运行

### 路线 C：重构为纯 Vue 3 + Vite（最后手段）

**思路**：移除 uni-app H5 构建，用标准 Vue 3 + vue-router + axios 重写前端。

**工作量**：大（3-5 天）
- 替换 `uni.navigateTo` → `router.push`（36 处）
- `uni.showToast/showModal/showLoading/hideLoading` → 自定义 toast 组件
- `uni.chooseImage/uploadFile/setStorageSync` → Web API
- 替换 `uni-ui` 组件（uni-popup/uni-load-more/uni-transition）
- 重写 `vite.config.ts`（移除 uni() 插件）
- 添加 vue-router 配置，55 个路由
- 重写请求层（移除 uni.request？目前用 axios？）

**优点**：
- 完全控制构建
- 不再依赖 DCloud 闭源插件
- 构建速度快，产物小

**风险**：
- 失去微信小程序/App 多平台能力
- 大量业务代码改动（300+ uni.* API 调用）
- 需要回归测试所有功能（55 个页面）
- 如果未来需要小程序，需维护两套或使用 taro/rax

---

## 推荐：路线 A → B → C 递进

### Phase 1：生成 pages-json-js 实体文件（今天）
1. 写 `scripts/generate-pages-json.js`（读取 pages.json + manifest.json）
2. 输出 `src/.gen/pages-json-js.ts`（包含所有页面 loader + `__uniConfig`/`__uniRoutes`）
3. 修改 `main.ts`：`import './.gen/pages-json-js'`
4. 移除 `renderChunk` `inject-uni-config` 插件
5. 重新构建 + 部署 + 用户验证

### Phase 2：如果 Phase 1 仍白屏（备用）
1. 启动 dev server 验证
2. 如果 dev 可用，诊断 build 独有问题
3. 向 DCloud 提交 issue

### Phase 3：如果全部失败
评估 C 的实际工作量，决定是否启动重构

---

## Phase 1 详细步骤

### Step 1：生成脚本
文件：`scripts/generate-pages-json.js`

逻辑：
```
读取 src/pages.json → JSON.parse
读取 src/manifest.json → JSON.parse
对于每个 page：
  const loaderName = normalizeIdentifier(page.path)
  生成: const ${loaderName}Loader = () => import('./${page.path}.vue').then(com => setupPage(com.default || com, '${page.path}.vue'))
  生成路由条目: { path: ..., component: { setup() { ... return () => renderPage(${loaderName}, query) } }, loader: ${loaderName}Loader, meta: ... }
生成 window.__uniConfig = extend({...}, {...})
生成 window.__uniRoutes = [{...}]
生成 CSS import 列表
```

### Step 2：接入构建流水线
- `prebuild` npm script 中运行生成脚本
- 生成文件加入 `.gitignore`

### Step 3：main.ts 改动
- 添加 `import './.gen/pages-json-js'`
- 确保 `uni` 和 `plugin` 导入与生成的代码配合

### Step 4：验证
- 重新构建
- grep 产物确认 `setupPage`/`PageComponent`/`renderPage` 存在
- 用户浏览器访问验证

---

## 关键文件清单
- `scripts/generate-pages-json.js` — 新建
- `src/.gen/pages-json-js.ts` — 生成的临时文件（gitignore）
- `src/main.ts` — 添加 import
- `vite.config.ts` — 移除 `inject-uni-config` 插件
- `dist/build/h5/assets/index-*.js` — 产物（自动重建）

---

## 开放问题
1. `setupPage` 和 `PageComponent` 是否可以直接从 `@dcloudio/uni-h5` 命名导入？
2. CSS 文件 `@dcloudio/uni-h5/style/framework/base.css` 等路径是否在构建时可解析？
3. 生成的代码中 `appId`/`appName` 等来自 `manifest-json-js` 虚拟模块——是否需要内联？
