# AGENTS.md — class_mansys 的 AI 作业规范

> 这份文件是给在本仓库干活的 AI（DSH / Hermes / Reasonix / ClaudeCode / Codex…）看的。
> **每次动手前先读它。** 与其它文档冲突时，以「第 1 节」列出的权威文档为准。

---

## 0. 这是什么项目

「区队管理系统」：**Express 后端 + Vue3/Capacitor 前端**（H5 与 Android 同一套代码）。
项目以 AI 辅助方式开发，提交者通常是 `code-worker`；发布链由 GitHub Actions 自动完成。

---

## 1. 先读什么（按顺序，别跳过）

| 文档 | 作用 |
|---|---|
| `docs/PROJECT_OVERVIEW.md` | **项目全景与权威现状**（与其它旧文档冲突时以它为准） |
| `docs/SYSTEM_ARCHITECTURE.md` | 分层架构、模块划分、**权限模型**、API 规范、数据库设计 |
| `standards/PROJECT_STANDARDS.md` | 目录与代码规范 |
| 领域细则 | `docs/FEE_RULES.md`（费率）、`docs/ADMIN_CONSOLE.md`（管理台）、`docs/FRONTEND_DESIGN_SYSTEM.md` + `design-system.md`（前端设计语言）、`docs/MCP.md`、`backend/API_INVENTORY.md`（接口清单） |
| 运维/发布 | `docs/OPERATIONS.md`、`docs/DEPLOY_UPGRADE.md` |

**不要靠猜改业务规则**（费率、权限、审批流尤其）。不确定就停下来问，不要"顺手"改。

---

## 2. 目录地图

```
backend/            Express API：app.js 入口，routes/ controllers/ services/ models/
                    middleware/ migrations/ tests/（vitest）
frontend-v3/        Vue3 + Vite + Pinia + Capacitor：src/{pages,components,stores,api,router,styles,utils}
scripts/            CI 辅助脚本（版本号、CI 库账号、GitHub Secrets）
.github/workflows/  CI/CD：ci.yml（lint+test）/ android-build.yml / release.yml / deploy.yml
ops/                部署相关（systemd）
docs/  standards/   文档与规范
dist/、frontend-v3/dist/、backend/dist/、backend/apk/   构建产物（已忽略，禁止手工提交）
```

---

## 3. 常用命令（改完必须自己跑一遍）

**后端**（`cd backend`）
```bash
npm run lint          # eslint .        ← 必跑
npm test              # vitest run      ← 必跑
npm run format:check  # prettier --check
npm run dev           # nodemon app.js（本地起服务）
npm run migrate -- status        # 看迁移状态（up / up --dry-run）
```

**前端**（`cd frontend-v3`）
```bash
npm run lint          # eslint .        ← 必跑
npm run typecheck     # vue-tsc --noEmit ← 必跑（只 vite build 不能替代）
npm test              # vitest run
npm run build         # vite build
npm run dev           # 本地起前端
```

> CI 里前端安装用的是 `npm ci --legacy-peer-deps`；本地如遇 peer 冲突同样加这个参数。

---

## 4. 数据库迁移（本仓库最容易出事的地方）

- 新增迁移 = 新建 `backend/migrations/NNN_描述.sql`，**编号递增、三位数**（只管理 `NNN_*.sql`）。
- **已应用的迁移文件禁止修改**：`schema_migrations` 表记录了每个文件的 sha256，改了会让所有环境对不上。
- 需要"回滚/修正"时：**新写一条迁移**，不要动历史文件。
- 收尾前跑 `npm run migrate -- status` 确认没有遗留待应用项。
- 禁止对生产库做破坏性操作（`DROP`/`TRUNCATE`/无条件 `DELETE`）；写操作要能说清影响范围。

---

## 5. 版本与发布（CI 管，别手改）

- `backend/data/app-version.json` 由 CI 在构建后通过 `scripts/update-app-version.sh` 写入 → **不要手工编辑**。
- APK/AAB 的构建与版本号提升由 `.github/workflows/android-build.yml`、`release.yml` 负责；H5 部署走 `deploy.yml`（手动触发）。
- **除非任务明确要求改 CI，否则不要改 `.github/workflows/*`。**

---

## 6. 红线（默认不动）

1. 构建产物：`dist/`、`frontend-v3/dist/`、`backend/dist/`、`backend/apk/`（已忽略，禁止提交）。
2. 密钥：**一律写 `.env.local`（已忽略）**。`.env.development`、`.env.production`、`.env.example` 是**入库**文件，不要往里写密钥/token。
3. `backend/data/app-version.json`、`.github/workflows/*`、已应用的迁移文件。
4. `backend/uploads/` 下的既有用户上传：不要删改（只读引用）。
5. 不要在仓库留下临时脚本、调试文件、日志；调试产物写 `/tmp`。
6. 不要为了"顺手"重构无关文件；不要把全量格式化（prettier 重排）混进功能提交。

---

## 7. 工作方式：按改动大小选一条

**A. 小改动** —— 文案、样式、单文件小修、纯文档：
可以按现状在当前分支改完直接提交。

**B. 中等以上改动** —— 跨前后端、数据模型/迁移、权限·资金·审批、依赖升级、批量重构、预计 >30 分钟：
1. **开分支**（`feat/<简述>`，或平台派发时用 `wemux/<任务id>-<简述>`）
2. 改完在本地跑齐：`lint` + `typecheck` + `test` + `build`
3. 提交并**开 PR**
4. 等 **`CI (lint + test)` 绿**，再合 `main`

> 判据一句话：**这次改动值不值得"事后有人再看一次 diff"？** 值得就走 B，不值得走 A。
> 若任务来自平台派发并带了「验收标准」，以验收标准为完成线，不要自行扩大范围。

**提交信息**：沿用现有风格 `<type>(<scope>): <中文描述>`，`type` 取 `feat / fix / docs / ci / polish / refactor / chore`。
一次提交只做一件事。

---

## 8. 干完活要交代什么

1. 改了哪些文件、**为什么**；
2. 跑了哪些检查、结果如何（lint / typecheck / test / build 的实际输出）；
3. 有没有需要人拍板的地方（**不确定就停下来问，不要猜**）；
4. 涉及数据库 / 权限 / 费率 / 发布链的改动，必须写明风险与回滚方式。

---

## 9. 本仓库踩过的坑（别重踩）

- CI 跑在 **self-hosted runner** 上；前端依赖安装必须 `npm ci --legacy-peer-deps`。
- 后端 CI 需要测试库（`DB_NAME=class_manage_sys_test`），会先执行迁移再跑测试。
- Android 构建期间若 `main` 被推进，回写版本文件会 non-fast-forward → 工作流里已加「先 rebase 再重试」，**改 CI 时不要删这段重试逻辑**。
- 前端 `typecheck` 是 `vue-tsc --noEmit`，`vite build` 通过不代表类型没问题。
- 手机端白屏这类问题曾因构建目标过高导致（已降到 es2019 并加启动兜底面板），改动构建目标前先看 `frontend-v3/vite.config.ts` 注释。
