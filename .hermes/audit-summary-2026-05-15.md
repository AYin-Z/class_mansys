# class_mansys 全量审计报告

**日期**: 2026-05-15 15:30
**扫描范围**: 前端 50+ 页面 + 后端 18 路由/10 控制器 + 配置/构建

## 已确认健康项 ✅

| 项目 | 状态 |
|------|------|
| 构建通过 (`npm run build`) | ✅ |
| 后端运行 (`curl HTTP 200`) | ✅ |
| 55 条路由全覆盖 | ✅ (100% 匹配) |
| 130+ API 端点前后端对接 | ✅ |
| SQL 注入防护 | ✅ (参数化查询全部到位) |
| 静态文件/限流隔离 | ✅ |
| 路由顺序（固定路径在/:id之前） | ✅ (全部正确) |
| composables 目录 (4 个文件) | ✅ (P0-P1 已完成) |
| 首页组件拆分 (5 个子组件) | ✅ (P6 已完成) |
| uni.* API shim (23 种 API) | ✅ (全部覆盖) |
| showModal callback 修复 | ✅ |
| uni-to-vue 插件 (标签/事件转换) | ✅ |
| 自定义 tab bar 5 板块 | ✅ (正确部署到 6 页面) |
| 毕业相册/通知编辑/附件等新功能 | ✅ |

## 待修复问题 🔴

### P0 — 运行时可见影响

| # | 问题 | 文件 | 严重度 | 影响 |
|---|------|------|--------|------|
| 1 | CSS 标签选择器 `view, text` 在构建后不匹配 (已转 `div, span`) | `src/App.vue:72` | **中** | `box-sizing` 全局样式不生效 |

### P1 — 代码整洁/遗留清理

| # | 问题 | 文件 | 严重度 |
|---|------|------|--------|
| 2 | `pages.json` 仍引用已删除的 `register.vue` | `src/pages.json` | 低 (legacy) |
| 3 | `pages.json` 缺少 `leave/overview` 条目 | `src/pages.json` | 低 (legacy) |
| 4 | `register.json` (46B stub) 已无对应 .vue 文件 | `src/pages/auth/register.json` | 低 |
| 5 | CORS 拒绝时返回 500 而非 403 | `backend/app.js:44` | 低 |
| 6 | 未使用的 import: `isAdmin` | `src/pages/notice/index.vue` | 极低 |
| 7 | 未使用的 import: `payCollection` | `src/pages/fee/collection.vue` | 极低 |

### P2 — 优化项

| # | 问题 | 文件 |
|---|------|------|
| 8 | Sass `@import` 已弃用, 建议改为 `@use` | 全部 uni.scss 引入方 (~20 文件) |
| 9 | `apk` 脚本调用 `cap open` (需 GUI), 应改为 `cap build` | `package.json` |
| 10 | 主 chunk > 500KB, 可考虑分拆 | 构建输出 |

## 结论

项目整体健康状况**优秀**。无 Critical 级 bug。后端路由/安全/数据库全部通过审计。主要整改项为 1 个 CSS 修复 + 清理遗留碎片。
