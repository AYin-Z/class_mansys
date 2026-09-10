# 中队化升级 · 部署与回滚手册

> 本手册记录本次「区队 → 中队」全系统升级的部署步骤与验证方式。已在 2026-09-10 于本机执行并通过。

## 1. 变更总览

- 数据库：新增 `companies`（中队）、`classes.company_id`、`suggestions.view_token`，以及 14 张内容表的 `class_id`（NULL=全局/中队级）。
- 后端：作用域解析 `shared/scope.js`、区队打标 `shared/classStamp.js`；请假/通知/公告/相册/作业/投票/抽奖/积分/心理/留言/资源/擂台/班费接入区队作用域；新增 `/api/company/*` 中队聚合接口。
- 前端：新增「中队总览」页与 Tab，`vue-tsc` 0 错误，生产构建通过；修复静态目录优先级（优先 `frontend-v3/dist`）。

## 2. 部署步骤（已执行）

```bash
# 0. 逻辑备份（无 mysqldump 时）
cd backend && node tests/backup-db.js class_manage_sys /home/ayin/db_backups

# 1. 应用迁移（P0 起改用迁移执行器：schema_migrations 记录 + 幂等）
node scripts/migrate.js status    # 查看已应用/待应用
node scripts/migrate.js up        # 应用全部待执行迁移
# 注意：CI/部署前先确认 status；迁移文件一经应用不可修改（校验和不一致会告警跳过）

# 2. 创建中队并将区队挂载（名称按实际填写；幂等）
node seed-company.js 1 "数据警务技术中队"

# 3. 构建前端（产物 frontend-v3/dist，Express 直接托管）
cd ../frontend-v3 && npm run build

# 4. 重启后端（加载新代码）
export XDG_RUNTIME_DIR=/run/user/1000
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
systemctl --user restart class-mansys.service
```

## 3. 上线后验证

```bash
curl -s http://127.0.0.1:3002/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/api/company/overview   # 期望 401（未带 token）
curl -s http://127.0.0.1:3002/ | grep -o "assets/index-[A-Za-z0-9_-]*\.js"            # 应与 frontend-v3/dist/index.html 一致
curl -s -D - -o /dev/null -H "Origin: https://evil.example.com" http://127.0.0.1:3002/health | grep -i access-control-allow-origin  # 期望无输出
```

端到端验收（独立测试库，不碰生产数据）：

```bash
cd backend
node tests/setup-test-db.js class_manage_sys_test2   # 克隆结构+迁移+种子
DB_NAME=class_manage_sys_test2 node seed-leave-config.js
DB_NAME=class_manage_sys_test2 node tests/fixtures.js
DB_NAME=class_manage_sys_test2 PORT=3103 NODE_ENV=test JWT_SECRET=test_secret_123 OTP_DEBUG_CONSOLE=true nohup node app.js > /tmp/test-server2.log 2>&1 &
E2E_BASE=http://127.0.0.1:3103 node tests/e2e-acceptance.js   # 期望 56 PASS / 0 FAIL
```

## 4. 行为变更提示

- **验证码（手机/邮箱）**：`NODE_ENV=production` 且未配置 `OTP_PROVIDER` 时，`POST /api/auth/send-code` 返回 **503**（此前是“假装成功”但发不出码）。如需启用，请接入短信/邮件服务商并设置 `OTP_PROVIDER`；临时调试可设 `OTP_DEBUG_CONSOLE=true`（仅打印到服务端日志）。
- **意见箱**：提交返回 `viewToken`；「我的提交」需凭 token 查询（`GET /api/suggestion/mine?tokens=`）。旧的 `my_suggestion_ids` 本地缓存不再使用。
- **`/uploads` 仍为公开静态目录**：本次已从 Git 移除并忽略，但未加鉴权（需要 token 化 URL 改造）。
- **旧版挑战（擂台）**：迁移回填时无创建者信息，2 条历史擂台 `class_id=NULL`（全局可见）。

## 5. 回滚

- 代码回滚：`git revert`/`git checkout` 到升级前提交并重启服务即可；新增列与表对旧代码无影响（均为可空/新增）。
- 数据回滚：本次备份为逻辑 JSON（`/home/ayin/db_backups/class_manage_sys_*.json`），用于核对与手工恢复；如需 SQL 级恢复请在部署前用 `mysqldump`。
- 前端回滚：`git checkout` 后重新 `npm run build`。
## 6. 事故记录：测试夹具误清生产库（已恢复）

**事件**：独立验收 subagent 在未指定 `DB_NAME` 的情况下执行了 `backend/tests/fixtures.js`，该脚本会清空业务表再写入测试数据，导致生产库 `class_manage_sys` 的 leaves/points/expenses/suggestions 等被替换为夹具数据（leaves 560→5、points 43→0、expenses 5→0，并多出测试区队 7）。

**处置**：
1. 立即中断该 subagent，停止后端服务。
2. 用部署前的逻辑备份 `/home/ayin/db_backups/class_manage_sys_2026-09-10T01-07-11-730Z.json` 全量恢复：`node tests/restore-db.js class_manage_sys <backup.json> --yes`。
3. 重跑迁移 010 回填 `class_id`、重跑 `seed-company.js` 重新挂载区队。
4. 校验：users 40 / leaves 560 / points 43 / expenses 5 / suggestions 5，classes 仅 6，均与备份一致。
5. 重启服务并冒烟通过。

**已加护栏（防复发）**：
- `tests/fixtures.js` 仅允许 `DB_NAME` 匹配 `_test[0-9]*$`，否则直接退出；确需强制需 `ALLOW_DESTRUCTIVE=1`。
- `tests/setup-test-db.js` 拒绝测试库名等于生产库名。
- `tests/restore-db.js` 必须显式 `--yes`。
- 所有破坏性脚本使用前请确认 `DB_NAME`；生产库请先 `node tests/backup-db.js`。

## 6.1 P0 工程化基座（2026-09-10 落地）

- 迁移执行器：`node scripts/migrate.js status|up`（`schema_migrations` 记录 sha256）；生产已应用 005-011。
- 环境校验：`backend/config/env.js`（zod）——生产缺 `JWT_SECRET` 或长度 <16 直接拒绝启动。
- 统一错误/响应：`backend/shared/http.js`；404/500 返回 `{success:false,error,code}`。
- 结构化日志：pino + pino-http，响应头带 `x-request-id`；`LOG_LEVEL=silent` 可静默。
- 测试与门禁：后端 `npm run lint && npm test`（43 项）、前端 `npm run lint && npm run typecheck && npm test && npm run build`（20 项）；CI 工作流 `.github/workflows/ci.yml`。
- 部署后校验：`curl /health`（含 uptime）、`curl /api/nope` 应返回 `code:NOT_FOUND`、响应头含 `x-request-id`。

## 7. 已知遗留

- `/uploads` 仍为公开静态目录（未加鉴权），需要 token 化 URL 改造。
- 生产 `OTP_PROVIDER` 未配置 → 验证码接口返回 503；如需手机/邮箱登录请先接服务商。
- 历史擂台（2 条）无创建者信息，`class_id=NULL`（全局可见）。
- 旧匿名建议无 `view_token`，提交者无法凭 token 回查（管理员仍可在后台查看全部）。
