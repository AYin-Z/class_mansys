# 运维手册（P3 后）

## 1. 目录与产物

| 项 | 位置 | 说明 |
|---|---|---|
| 后端代码 | `/home/ayin/Current_Works/class_mansys/backend` | systemd 用户服务 `class-mansys.service` |
| 前端产物 | `frontend-v3/dist` | Express 直接托管（优先于根目录 `dist/`） |
| 用户上传 | `backend/uploads`（`UPLOAD_DIR` 可覆盖） | **需登录访问**，见下 |
| APK 发布产物 | `/home/ayin/class-mansys-artifacts/apk`（`APK_DIR`） | **不再入库**；`/apk/<file>` 公开下载 |
| 数据库备份 | `/home/ayin/db_backups`（`BACKUP_DIR`） | 逻辑 JSON，保留最近 14 份 |

## 2. 迁移

```bash
cd backend
node scripts/migrate.js status   # 已应用/待应用
node scripts/migrate.js up       # 应用（幂等，记录在 schema_migrations）
```

约定：迁移文件一经应用不可修改（校验和不一致会告警并跳过）；新增迁移按 `NNN_name.sql` 编号，必须幂等。

## 3. 备份与恢复

```bash
# 手动备份
bash backend/scripts/backup.sh

# 定时备份（已安装为用户级 systemd timer，每日 03:30）
systemctl --user list-timers class-mansys-backup.timer
systemctl --user start class-mansys-backup.service   # 立即跑一次

# 恢复（危险，需 --yes）
cd backend && node tests/restore-db.js class_manage_sys /home/ayin/db_backups/<file>.json --yes
#   恢复后如涉及新增列，重跑 node scripts/migrate.js up 回填
```

> 注意：逻辑备份用于核对与手工恢复；需要 SQL 级恢复请在部署前用 `mysqldump`。恢复前先停服务。

## 4. /uploads 访问控制

- 机制：`backend/middleware/uploadAuth.js`，支持 `Authorization: Bearer <jwt>` 或 `?token=<jwt>`。
- 前端统一用 `frontend-v3/src/utils/media.ts` 的 `mediaUrl()` / `openMedia()` 追加令牌；新增页面渲染上传资源时必须使用它。
- **模式开关**：`UPLOAD_AUTH_MODE`（`strict` | `compat`，默认 `strict`）。
  - `compat`：放行未携带令牌的请求（仅首次打印告警），用于兼容尚未带令牌的旧 APK。**当前生产为 compat**。
  - 切换到 strict 的时机：新版 APK（含 mediaUrl）发布并铺开后，把 `backend/.env` 的 `UPLOAD_AUTH_MODE` 改为 `strict` 并重启服务。
  - 切换后自检：`curl -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/uploads/leaves/<file>` 应为 401。
- `/apk/**` 仍为公开静态目录（App 自助下载），产物在 `APK_DIR`（默认 `/home/ayin/class-mansys-artifacts/apk`）。

## 4.1 定时任务

| Timer | 时间 | 作用 |
|---|---|---|
| `class-mansys-backup.timer` | 每日 03:30 | 逻辑备份到 `/home/ayin/db_backups`（保留 14 份） |
| `class-mansys-digest.timer` | 每日 08:00 | 生成并发送「每日建议汇总」到 `SUGGESTION_DIGEST_TO`（默认 2792715318@qq.com），同时落盘 `/home/ayin/db_backups/digests/` |

```bash
systemctl --user list-timers class-mansys-*.timer
systemctl --user start class-mansys-digest.service   # 立即执行一次
journalctl --user -u class-mansys-digest.service -n 20 --no-pager
```

邮件：已在 `backend/.env` 配置 QQ 邮箱 SMTP（授权码方式），每日 08:00 自动发送；未配置时仅落盘。

## 4.2 验证码通道

| 目标 | 通道 | 现状 |
|---|---|---|
| 邮箱 | SMTP 真实发信（`services/mailer.js`） | ✅ 已启用（生产实测 200） |
| 手机号 | 需短信服务商（`OTP_PROVIDER=sms/webhook`） | ⛔ 未接入，返回 503 并明确提示「短信服务未配置」 |

说明：验证码 5 分钟有效、单码最多尝试 5 次、同一目标 1 分钟最多 3 次；生产环境不回显验证码。

## 5. 发布前端

```bash
cd frontend-v3 && npm run build   # 产物写到 dist，Express 直接生效（无需重启后端）
```

## 6. 发布后端

```bash
export XDG_RUNTIME_DIR=/run/user/1000
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
systemctl --user restart class-mansys.service
curl -s http://127.0.0.1:3002/health
```

## 6.x 微信 worker 与 MCP

```bash
# 微信（iLink）worker：首次需扫码登录，之后常驻
cd backend && node scripts/ilink-login.js          # 微信扫码 → ~/.class-mansys/weixin.json
cp ops/systemd/class-mansys-ilink.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now class-mansys-ilink
journalctl --user -u class-mansys-ilink -f         # 排障

# MCP：用户自带 agent 接入（令牌在 App 内生成）
CM_API_TOKEN=cm_xxx CM_ALLOW_WRITE=1 node backend/mcp/server.js   # stdio，由 MCP 客户端启动
```

## 7. 质量门禁（CI 与本机一致）

```bash
# 后端：lint + 单测（111 项，含 MCP 工具映射 / iLink 协议构造 / 令牌哈希）
cd backend && npm run lint && npm test
# 前端：lint + 类型 + 单测（20 项）+ 构建
cd frontend-v3 && npm run lint && npm run typecheck && npm test && npm run build
# 端到端（独立测试库 + 独立端口，86 项）
cd backend && node tests/setup-test-db.js class_manage_sys_test && \
  DB_NAME=class_manage_sys_test NODE_ENV=test node tests/fixtures.js && \
  DB_NAME=class_manage_sys_test PORT=3102 NODE_ENV=test AGENT_LLM_MODE=mock nohup node app.js > /tmp/e2e-srv.log 2>&1 & \
  E2E_BASE=http://127.0.0.1:3102 node tests/e2e-acceptance.js

# 渠道链路冒烟（11 项，不依赖微信）：绑定码 -> /绑定 -> Agent 读写确认 -> /解绑
DB_NAME=class_manage_sys_test NODE_ENV=test AGENT_LLM_MODE=mock SELF_BASE_URL=http://127.0.0.1:3102 \
  node tests/channel-smoke.js

# MCP 冒烟（真实令牌 + stdio 客户端，对生产只读调用）
CM_TOKEN=cm_xxx node tests/mcp-smoke.mjs

# 说明：setup-test-db.js 会克隆生产库结构 + 复制参照数据（leave_config），
# 因此测试库的请假类型/时段校验与生产一致（早操为 07:00-08:00）。
# 测试库名必须匹配 _test，fixtures.js 拒绝在非测试库上运行（防误清生产数据）。
```
