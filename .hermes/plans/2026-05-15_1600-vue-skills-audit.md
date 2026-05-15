# class_mansys 全面排查计划 — 利用 17 个新 Vue skill

> 使用新安装的 Vue 生态 skill 对 class_mansys 项目做系统性的代码审计、架构评估和问题诊断。
> 创建时间：2026-05-15 16:00

---

## 目标

1. 定位 H5 白屏根因并修复
2. 按 Vue 最新最佳实践审视项目架构
3. 识别可重构/优化的代码片段
4. 输出可执行的修复清单

## 排查框架

按**纵深递进**顺序排查，每步使用对应 skill 作为方法论参考：

### Phase 1：构建与部署层（白屏根因）

**负责人：** vite + uni-app-h5-deployment + uni-app-vue-dev + codebase-inspection

| 步骤 | 内容 | 使用的 Skill | 验证方式 |
|------|------|-------------|---------|
| 1.1 | 审计 vite.config.ts — 插件链、构建配置、target、base 路径 | `vite` (core-config) | 对照 Vite 文档检查每项配置合理性 |
| 1.2 | 调试 uni-app H5 构建 — 验证 uni:h5-main-js 插件是否命中 main.ts | `uni-app-vue-dev` (白屏诊断章节) | 在构建产物中搜索 `mount.*#app`, `@dcloudio/uni-h5` |
| 1.3 | 检查 main.ts 入口模式 — SSR factory export vs 自挂载 | `vue` (script-setup-macros) | 确认 createApp() 被调用且 mount 到 #app |
| 1.4 | 检查 Express 中间件 — helmet CSP、CORS、静态文件服务 | `uni-app-h5-deployment` | curl 验证响应头 |
| 1.5 | 验证 CDN 缓存策略 — Cloudflare 边缘节点 | (系统运维) | last-modified vs 本地文件 mtime |
| 1.6 | 审计 App.vue onLaunch — 是否有阻塞初始化的逻辑（CloudBase SDK） | `vue` | 检查 try-catch 是否兜底 |

### Phase 2：架构与组件层

**负责人：** vue-best-practices + vue + pinia

| 步骤 | 内容 | 使用的 Skill | 验证方式 |
|------|------|-------------|---------|
| 2.1 | 扫描所有 .vue SFC — 检查 `script setup` 使用一致性、Options API 混合 | `vue-best-practices` (SFC 结构) | 统计 `<script>` vs `<script setup>` 占比 |
| 2.2 | 组件边界审计 — 检查超大组件（>300 行）、多层职责混合 | `vue-best-practices` (组件拆分原则) | 按行数排序、人工审查 top-N |
| 2.3 | Data flow 审计 — props down / events up 模式一致性 | `vue-best-practices` (component-data-flow) | 检查 defineProps/defineEmits 使用 |
| 2.4 | Pinia store 审计 — 检查 store 定义方式、storeToRefs 使用 | `pinia` (core-stores, features-composables) | 检查所有 store 文件 |
| 2.5 | Composables 提取机会 — 识别可抽取为 composable 的逻辑块 | `vue-best-practices` (composables) | 检查页面 script 中可复用的状态逻辑 |
| 2.6 | vite.config.ts 插件链优化 — 检查必要/冗余插件 | `vite` (core-plugin-api) | 对照 `@dcloudio` 插件链 |

### Phase 3：路由与导航层

**负责人：** vue-router-best-practices + uni-app-vue-dev

| 步骤 | 内容 | 使用的 Skill | 验证方式 |
|------|------|-------------|---------|
| 3.1 | pages.json 注册完整性 — 所有 .vue 都已注册 | `uni-app-vue-dev` (死代码检测) | 文件系统 vs pages.json 对比 |
| 3.2 | 导航目标有效性 — navigateTo 目标都存在于 pages.json | `uni-app-vue-dev` | 正则抓取所有导航 URL，逐一匹配 |
| 3.3 | 路由参数变更生命周期 — 同一页面不同参数是否重新加载 | `vue-router-best-practices` | 检查 watch route params |

### Phase 4：UI 与设计层

**负责人：** web-design-guidelines + vueuse-functions + unocss

| 步骤 | 内容 | 使用的 Skill | 验证方式 |
|------|------|-------------|---------|
| 4.1 | Web 界面规范检查 — 对照 Vercel 的 Web Interface Guidelines | `web-design-guidelines` | 获取最新 guidelines + 逐一检查 |
| 4.2 | 响应式/VueUse 机会 — 识别可替换为 VueUse 的自定义代码 | `vueuse-functions` | 检查 `ref`, `watch`, `computed` 使用模式 |
| 4.3 | CSS 架构审计 — 检查 scoped styles、设计变量使用 | `uni-app-vue-dev` | 检查 uni.scss 变量引用 |
| 4.4 | UnoCSS 兼容性评估 — 是否需要引入 utility-first CSS | `unocss` (先 skill_view) | 评估当前 CSS 体积和一致性 |

### Phase 5：测试与验证层

**负责人：** vue-testing-best-practices + vitest

| 步骤 | 内容 | 使用的 Skill | 验证方式 |
|------|------|-------------|---------|
| 5.1 | 测试基础设施评估 — 是否有 vitest/playwright 配置 | `vue-testing-best-practices` | 检查 package.json、vitest.config |
| 5.2 | 关键路径测试建议 — 为班费审批流、请假流写组件测试 | `vue-testing-best-practices` | 产出测试骨架 |

---

## 当前已知问题（前置）

| # | 问题 | 严重度 | 状态 |
|---|------|--------|------|
| P1 | H5 白屏 — JS 构建产物不含 mount 代码 | 🔴 | 部分修复（main.ts 自挂载已加，缺 @dcloudio/uni-h5 plugin） |
| P2 | `uni` 全局未定义 — 自挂载未注册 uni-h5 plugin | 🔴 | 待查 |
| P3 | CloudBase SDK 在 H5 中初始化可能失败 | 🟡 | 待验证 |
| P4 | CDN 缓存策略不合适 | 🟡 | 已清理但未长期解决 |
| P5 | sass @import 弃用警告 | 🟢 | 非阻塞 |

## 影响面分析

| 变更 | 影响范围 | 回滚方式 |
|------|---------|---------|
| main.ts 入口修改 | 整个 H5 渲染入口 | git revert |
| vite.config.ts 插件变更 | 构建流程 | git revert |
| Express 中间件变更 | 全站响应头 | git revert |
| Store/组件重构 | 具体页面功能 | git revert |

## 风险

- Phase 1 中尝试修复 uni-h5 plugin 注入可能导致构建失败（已发生一次）
- 切换 `<script setup>` 一致性可能触发 uni-app 兼容性问题
- 引入 VueUse 需要安装新依赖 `@vueuse/core`

## 保存位置

- 本计划：`.hermes/plans/2026-05-15_1600-vue-skills-audit.md`
- 每次 Phase 完成后更新：`~/.hermes/CONTEXT_INHERITANCE.md`
