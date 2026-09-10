# 重构优化计划（P0 已完成）

> 背景：系统首版由 2026-04 的模型/harness 产出（109 commits，约 21.5k 行：后端 6.8k JS / 前端 14.7k TS+Vue）。当前瓶颈不是语言或框架，而是缺少工程化基座与边界。策略：**绞杀者式渐进重构**——保留 Express + Vue3 与既有 API 契约（已分发 APK 依赖），逐层替换。

## 已完成：P0 工程化基座

| 能力 | 落地 |
|---|---|
| 迁移执行器 | `backend/scripts/migrate.js`（`status` / `up` / `--dry-run`），`schema_migrations` 记录 + sha256 校验；已把 005-011 纳入并在生产验证 |
| 迁移规范 | 修复 005（MySQL 不支持的 `ADD COLUMN IF NOT EXISTS`）与 007（重复插入）为幂等写法；新增测试守护（禁止 `USE db`、要求幂等） |
| 环境校验 | `backend/config/env.js`（zod）：启动即校验，生产缺 `JWT_SECRET`/弱密钥直接拒绝启动 |
| 统一错误/响应 | `backend/shared/http.js`：`ok/fail/asyncHandler/notFoundHandler/errorHandler` + 领域错误类；404/500 统一 `{success,error,code}` |
| 结构化日志 | `backend/config/logger.js`（pino）+ `pino-http`，请求 ID（`x-request-id`）与敏感头脱敏；测试环境静默 |
| 后端测试 | vitest + supertest：43 项（常量/权限、HTTP 助手、作用域、迁移规范、API 冒烟） |
| 前端测试 | vitest + jsdom：20 项（角色权限矩阵、XSS 清洗、查询串构造） |
| Lint/格式 | 后端/前端 ESLint flat config + Prettier + EditorConfig；当前 0 error |
| CI 门禁 | `.github/workflows/ci.yml`：后端 lint+test+迁移状态；前端 lint+typecheck+test+build |
| 可测试性 | `app.js` 改为仅直接运行时 `listen`，便于 supertest 导入；数据库连接失败仅在 development 退出 |

回归底座：`backend/tests/e2e-acceptance.js`（67 项端到端，跑在独立测试库 + 独立端口实例）。

## 已完成：P1 契约与权限统一

- `backend/shared/permissions.js`：权限矩阵（后端权威）+ `hasPermission` + `requirePermission` 中间件；26 个权限键。
- 所有路由改为 `requirePermission(...)`，删除控制器里散落的 `isAdmin/role===X` 判断（公告/作业/积分/抽奖/擂台/投票/相册/心理/建议/通知/班费/管理员）。
- `backend/shared/validate.js` + `backend/shared/schemas.js`：zod 校验（24 个 schema，接入 39 处路由），校验失败统一 400 `VALIDATION_ERROR`。
- 测试：`tests/unit/permissions.test.js`、`tests/unit/validate.test.js` 覆盖矩阵、中间件与关键 schema，并带有前后端矩阵一致性检查。

## 已完成：P3 数据与运维加固

- APK 出仓库：产物移至 `/home/ayin/class-mansys-artifacts/apk`（`APK_DIR`），`/apk` 仍公开下载；CI 改为写入该目录且不再提交 APK。
- `/uploads` 鉴权：`middleware/uploadAuth.js`（Bearer 或 `?token=`），前端 `utils/media.ts` 统一追加令牌，共 9 个页面接入。
- 备份：`scripts/backup.sh` + `tests/backup-db.js`，已安装用户级 systemd timer（每日 03:30，保留 14 份）。
- 运维文档：`docs/OPERATIONS.md`。

## 进行中：P2 后端分层

- 已完成：
  - 请假域 `services/leaveService.js`（业务规则 + 作用域校验），`LeaveController` 变为纯 HTTP 适配层（218 → 62 行）。
  - 认证域 `services/authService.js`（验证码存储/令牌签发与校验/密码哈希与校验/目标归一化），`AuthController` 去除本地 helper 定义，统一走 service。
- 待完成：班费域（`FeeController` 333 行）service 化；其余控制器按域推进。

## 后续阶段

### P1 契约与权限统一
- 把散落的 `isAdmin/role===X` 判断收敛为单一 permission matrix + `requirePermission()` 中间件（后端权威，前端只做展示）。
- 写接口统一 zod 校验（`shared/validate.js`），错误走 `BadRequestError`。
- 响应结构统一为 `{success,data}`，旧字段保留一版兼容层，前端分批切换。

### P2 后端分层（按域推进）
- `AuthController`（699 行）拆为 `auth/` service + repository；随后 leave、fee 两域。
- controller 只做 HTTP 契约与校验，service 承载业务用例，model 仅 SQL。
- 每个域补齐单测（复用 E2E 场景）。

### P3 数据与运维
- `/uploads` 鉴权（token 化 URL 或对象存储直传），APK 走 GitHub Release/CDN 出仓库。
- 备份/恢复脚本化（`tests/backup-db.js` / `restore-db.js` 已在，需接入定时任务与演练）。

### P4 前端结构
- 拆 `admin/panel.vue`（861 行）等巨型组件；按 feature 目录组织；统一 `useRequest`/缓存/错误处理；抽公共 UI 组件。

### P5 可选
- 后端 TypeScript 渐进（先 JSDoc + checkJs，再逐文件迁移）；ORM 评估；可观测性（指标/告警）。

## 常用命令

```bash
# 后端
cd backend
npm run lint && npm test          # 门禁
node scripts/migrate.js status    # 迁移状态
node scripts/migrate.js up        # 应用迁移（幂等）

# 前端
cd frontend-v3
npm run lint && npm run typecheck && npm test && npm run build
```
