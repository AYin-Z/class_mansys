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
  - `compat`：放行未携带令牌的请求（仅首次打印告警），仅用于兼容尚未带令牌的旧 APK，**不要长期使用**（等于上传资源全部公开）。
  - **当前生产已切换为 `strict`**（2026-09-11）：无令牌访问 `/uploads/**` 返回 401，带令牌返回 200 且响应头为 `Cache-Control: private, max-age=300`。
  - 自检：`curl -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/uploads/leaves/<file>` 应为 401；经 nginx 同样应为 401（记得带 `Host: cls.ayinserver.xin`）。
  - **nginx 注意**：`location /uploads/` 里**不要**再写 `expires` 或 `add_header Cache-Control "public"` —— 会与应用的 `private` 冲突，把受保护的请假证明/报销凭证放进共享缓存 7 天（本轮已从仓库 `nginx-cls.conf` 与线上 `/etc/nginx/sites-enabled/cls.ayinserver.xin` 移除，缓存策略统一由应用决定）。
  - 日志脱敏：`config/logger.js` 对 `req.url`/`url`/`*.url` 做敏感参数局部脱敏（token/secret/password/code 等 → `***`），并覆盖了 pino 会把 `req.query` 序列化落盘的问题。
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
# 后端：lint + 单测（173 项，含 MCP 工具映射 / iLink 协议构造 / 令牌 / 权限矩阵 / 超管接口）
cd backend && npm run lint && npm test
# 前端：lint + 类型 + 单测（45 项，含 API 拆包契约 / 用户手册 / MCP 文案）+ 构建
cd frontend-v3 && npm run lint && npm run typecheck && npm test && npm run build
# 端到端（独立测试库 + 独立端口，108 项）
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

## 8. CI 基础设施与 APK 发布链（2026-09-11 修复）

### 8.1 CI 用的测试库账号

后端 CI 需要真实数据库（令牌校验、权限矩阵等用例会查库），但仓库是**公开仓库**，
口令不能写进 workflow 文件。做法：

```bash
# 创建/轮换 ci_runner（只授予 class_manage_sys_test 权限，读不到生产库），
# 随机口令写入 GitHub Secrets：CI_DB_USER / CI_DB_PASSWORD
bash scripts/setup-ci-db-user.sh          # 需能读到 backend/.env 的 root 口令
bash scripts/setup-ci-db-user.sh --no-gh  # 只建账号，口令打印到终端
```

* `ci.yml` 的 backend 作业通过 job env 注入 `DB_*`、`JWT_SECRET`、`NODE_ENV=test`，
  并在测试前跑 `node scripts/migrate.js up`（测试库结构始终与代码同步）。
* 本地没有数据库时，`tests/lib/dbProbe.js` 会让相关用例 **skip** 并打印原因；
  `CI=true` 时**不跳过**（连不上就该红，避免静默跳过掩盖回归）。
* 未经授权的破坏性脚本仍由 `tests/lib/dbGuard.js` 拦截（库名必须以 `_test` 结尾）。

### 8.2 版本号规则

`scripts/ci-version.sh` 产出 `versionCode = YYMMDD * 100 + 当日序号`（8 位数字）。

* Android versionCode 是 32 位有符号整数，上限 2147483647。
  旧方案 `YYYYMMDD + 4 位序号` 是 12 位数字，Gradle `toInteger()` 直接抛
  `For input string: "202609110003"`，构建必失败——**不要退回该方案**。
* 脚本以 `scripts/.versionCode`（gitignore）为基线，保证严格递增；
  读到越界的历史值会忽略，不会把错误传染给下一次构建。
* `versionName` 取自 `frontend-v3/package.json`，发布前记得手动提升（当前 1.3.0）。

### 8.3 签名现状（重要）

* 线上 APK 一直是 **debug 签名**：`CN=Android Debug`，
  证书 SHA-256 `b6ddde0b…9a4e1c`，与本机 `~/.android/debug.keystore` 完全一致。
  因此 CI 用 debug 签名构建的新包可以**直接覆盖安装**，用户无需卸载。
* `/home/ayin/android-key/class-mansys-release.keystore` 存在，但**口令已丢失**
  （本机与备份里都找不到），所以暂时无法切回 release 签名。
* 缺 secrets 时 `android-build.yml` 自动回退 debug 签名并给出 warning；
  一旦 `KEYSTORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD`（+ `KEYSTORE_BASE64`）配好，
  会自动切回 release 签名——**届时老用户需要卸载重装一次**（签名不同无法覆盖）。
* 若想重新掌握签名，只能新建 keystore 并接受一次卸载重装；
  建议顺手把口令存进密码管理器 + GitHub Secrets，别再只留文件。

### 8.4 发布链路

```
push main → android-build.yml: 构建 APK → 复制到 /home/ayin/class-mansys-artifacts/apk/
         → scripts/update-app-version.sh 生成 backend/data/app-version.json（JSON 校验通过才继续）
         → CI Bot 提交并推送（需 permissions: contents: write）
         → 生产目录 git pull --ff-only → 重启 class-mansys.service
         → curl /api/app/latest 校验版本号
```

* 生产服务跑在 `/home/ayin/Current_Works/class_mansys`，runner 的 checkout 在
  `actions-runner/_work/...`，两者不是同一目录；**只提交不 pull，App 里永远看到旧版本**。
* `/apk/<文件名>` 由 nginx 对外提供，`downloadUrl` 指向该路径。
* 更新日志取提交标题行（`workflow_dispatch` 时可手动填 `changelog`）；
  传的是**原始文本**，JSON 转义由脚本负责，调用方不要再 `json.dumps`。
