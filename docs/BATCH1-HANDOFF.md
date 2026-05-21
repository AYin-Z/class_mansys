# Batch 1 迁移任务 — 子代理工作手册

## 项目全局上下文

- **新前端 (v2)**：`/home/ayin/Current_Works/class-mansys-v2/`
- **旧 uni-app**：`/home/ayin/Current_Works/class_mansys/src/`
- **架构文档**：`/home/ayin/Current_Works/class_mansys/docs/SYSTEM_ARCHITECTURE.md`
- **迁移计划**：`/home/ayin/Current_Works/class-mansys/docs/MIGRATION_PLAN.md`
- **后端**：运行在 localhost:3002，无需改动

### 新前端的 API 层、工具函数、Store
v2 已存在：
- `src/api/notice.ts`, `src/api/homework.ts`, `src/api/leave.ts`, `src/api/fee.ts` — 各模块 API 封装
- `src/utils/request.ts` — axios 封装含 JWT
- `src/utils/ui.ts` — `showToast(msg)`, `showConfirm(msg)`, `showError(msg)` 替换 uni.showToast/uni.showModal
- `src/stores/user.ts` — Pinia user store
- `src/router/index.ts` — vue-router 路由表（已有基础路由）
- `src/layouts/default.vue` — 默认布局（含 NavBar + TabBar）
- `src/styles/variables.css` — CSS 变量
- `src/utils/avatar.ts` — 头像工具

### 核心迁移替换规则
| uni-app 写法 | Vue 3 替换 |
|-------------|-----------|
| `uni.navigateTo({ url })` | `router.push(path)` |
| `uni.navigateBack()` | `router.back()` |
| `uni.showToast(...)` | `showToast(msg)` from `@/utils/ui` |
| `uni.showModal({ content })` | `showConfirm(msg)` from `@/utils/ui` |
| `uni.showLoading()` / `hideLoading()` | `showLoading()` / remove loading |
| `uni.request({ url, method, data })` | `api.xxx(params)` |
| `uni.uploadFile({ url, filePath })` | `FormData` + API call |
| `uni.setStorageSync(key, val)` | `localStorage.setItem(key, val)` |
| `uni.getStorageSync(key)` | `localStorage.getItem(key)` |
| `@tap` | `@click` |
| `rpx` 单位 | `px` 或 `rem`（1rpx ≈ 0.5px） |
| `<picker>` | `<select>` 或自定义组件 |
| `uni.scss` 导入 | `@/styles/variables.css` |

### 新页面必做事项
1. 在 v2 `src/pages/<module>/` 下创建 `<name>.vue`，使用 `<script setup lang="ts">`
2. 在 `src/router/index.ts` 中注册路由（使用 `import()` 懒加载）
3. 组件直接 import v2 已有的 API 模块：`import { publishNotice } from '@/api/notice'`
4. 使用 Pinia store：`import { useUserStore } from '@/stores/user'` + `const userStore = useUserStore()`
5. 权限控制：`import { hasPermission } from '@/api/user'` 或检查 `userStore.isAdmin`
6. 完成后验证 `npm run build` 不报 TS/import 错误
7. **不要**额外引入 npm 包——禁止添加 `npm install xxx`。所有需求用已有依赖（vue, vue-router, pinia, @vueuse/core）满足
