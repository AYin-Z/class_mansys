# Agent Harness v2：连续任务、附件、预校验与失败恢复

> 基线：本地开发/生产已部署 `410f319`（领先 GitHub `origin/main` 27594a8 共 14 个已上线提交）。
> 本文对应迁移 `030_agent_harness.sql`，只改后端/测试/文档，不改前端、工作流与生产目录。
> 文中场景均为脱敏合成样本，不包含真实聊天、姓名、请假证明或图片。

## 1. 要解决的问题（来自 2026-10-22 的真实证据）

一次「下午集合请假」在微信里被拆成 5 个互不相干的会话（`agent_conversations` 56~60）：

| 现象 | 直接原因 | 本次修法 |
|---|---|---|
| 每条微信消息新建会话 | `channelService.handleInbound` 调 `AgentService.chat` 不传 `conversationId`，`agentService` 缺 ID 就新建 | `agent_channel_sessions` 指针 + `channelSession.resolveSession()`；`handleInbound` 显式传 `conversationId` |
| 图片单独成会话、后续「那是我的证明」丢图 | 会话没续接；vision 只发当前轮图片 | 会话指针 + 草稿附件清单 + 本轮无新图时最多回送 2 张草稿图 |
| type 写成数字 2、日期写成 9/13、早集合写成 14:00-14:30 | 工具 schema 的 `type` 是自由 string，确认前零校验 | 动态 enum + `preflight.js` 在生成卡片前校验真实配置/时间/窗口 |
| 确认后才发现 `expected string` 失败 | 校验发生在执行阶段，失败没有纠错预算 | 预校验失败不建 action；结构化错误回模型，最多 2 次纠错 |
| 重复/并发确认可能重复提交 | `markAction` 无版本、无原子抢占，confirm 先读后写 | `state_version` + `claim_token` 原子 UPDATE；抢占后按最新配置复验 |
| 附件可被自由引用 | 只有 URL 字符串，没有 owner 登记 | `agent_attachments` 登记 owner/sha256；chat 前 403 拦截 |
| 回退纯文本模型时图片被静默剥掉 | `stripImageParts` 直接丢 image 块 | 改为显式「图片不可见 + 文件名/路径」占位 |

这不是模型能力问题：主模型 `Qwen3-VL-4B` 能读出请假条信息，失败发生在**数据流与确定性校验**层。

## 2. 边界与不变量

1. **权限不放松**：Agent 仍以用户 token 走内部 API，权限矩阵、作用域、zod、审计照旧；图片内容/姓名不构成授权。
2. **人工确认不取消**：中高风险写操作仍生成确认卡片；只有后果无害且只影响自己的低风险操作才自动执行。
3. **确认前无副作用**：预校验只读 `leave_config`，不写业务表。
4. **确认绑定具体版本**：`agent_actions.state_version + params_hash + config_hash` 任一不符即作废。
5. **附件不串用户**：未登记或 `user_id` 不匹配一律 403；新任务不继承旧任务附件。
6. **旧数据可读**：`state` 为 NULL 视为空草稿；旧 action 的 `*_hash` 为 NULL 时跳过哈希比较，但仍做预校验。
7. **只增不删**：迁移只新增表/列/索引，不改历史迁移，不删除任何业务数据。

## 3. 数据模型（`030_agent_harness.sql`）

### 3.1 `agent_conversations`

新增：

- `state JSON NULL`：当前任务草稿
- `state_version INT NOT NULL DEFAULT 0`：乐观锁版本
- `closed_at DATETIME NULL`：会话关闭时间

`state` 结构：

```json
{
  "tool": "apply_leave",
  "status": "collecting|awaiting_confirm|completed|failed",
  "fields": { "type": "午集合", "start_time": "...", "end_time": "...", "reason": "..." },
  "attachments": [{ "url": "/uploads/agent/x.png", "name": "证明.png", "mime": "image/png", "size": 123 }],
  "last_error": { "code": "LEAVE_OUTSIDE_WINDOW", "message": "..." },
  "revision": 3
}
```

### 3.2 `agent_channel_sessions`

`(channel, external_id)` 唯一，记录 `user_id / conversation_id / status / expires_at`。
同一微信身份只保留一行；轮换时更新指针，不新增多行。

### 3.3 `agent_attachments`

`url` 唯一，记录 `user_id / conversation_id / name / mime / size / sha256 / source`。
App 上传与微信入站落盘后立即登记；上传时 `conversation_id` 为空，首次随消息进入会话时绑定。

### 3.4 `agent_inbound_dedup`

`PRIMARY KEY(channel, external_id, message_id)`。worker 处理前 `INSERT IGNORE`；重复消息直接跳过。

### 3.5 `agent_actions`

新增 `state_version / params_hash / config_hash / claim_token / claimed_at / invalidated_at`。
`status` 新增值：`executing / superseded / invalidated`。

## 4. 渠道会话生命周期

`services/agent/channelSession.js`：

```
(channel, external_id) 无记录 ──> 新建 conversation + session
有记录且 12h 内有消息且未过 7d ──> 续接
超过 12h 空闲 / 超过 7d 绝对期限 ──> 关闭旧 conversation，建新 conversation
/新会话 | /新对话 | /reset ──> 立即轮换
绑定 / 解绑 / 换绑 ──> 关闭旧会话指针
```

- `expires_at = 建立时 + 7d`，每次轮换重置；`updated_at` 用于 12h 空闲判断。
- 关闭旧会话写 `closed_at`，历史消息仍保留、仍可读，但不再接受新消息（App 显式带旧 ID 会得到 `CONVERSATION_CLOSED`）。
- `AgentService.chat` 仍二次校验 `conversation.user_id === 当前用户`，渠道指针不是权限来源。
- 日志：`session_rotated`（reason=`reset|expired|user_changed`）、`dedup_hit`。

## 5. 任务草稿状态机

`services/agent/taskState.js`：

```
collecting ──字段齐全 + 预校验通过──> awaiting_confirm
     ^                                    │
     └────失败可补正（last_error）─────────┘
awaiting_confirm ──确认执行成功──> completed
                 └─确认执行失败──> failed ──用户补正──> collecting
```

合并规则：

1. 只有**同一 tool 且状态为 collecting/awaiting_confirm/failed** 时才继承旧字段。
2. 模型本轮显式给出的非空值覆盖旧值；没给的字段保留。
3. 附件按 URL 去重累积。
4. 换工具、`completed` 后重新发起 → 开新草稿，**不继承旧附件**（避免把上一次请假的证明挂到新申请）。
5. 每次草稿变更 `state_version + 1`；写工具缺字段时也会落草稿，下一轮仍能续上。

注入方式：`persona.buildUserContext(user, message, extra)` 把「真实请假配置 + 本周附件 + 草稿 + last_error」拼在**当前 user 消息**里，不写进 system prompt（保护前缀缓存）。用 `【用户原话】` 与辅助上下文分隔，避免辅助信息被当作用户意图（mock 模式尤其明显）。

## 6. 写操作预校验（`services/agent/preflight.js`）

在 `actionPreview.describe` 和 `createAction` **之前**执行；失败不建 action、不执行。

### 6.1 `apply_leave`

- `type` 必须是启用 `leave_config.type_name` 的精确字符串；拒绝数字、别名、禁用类型。
- `start_time/end_time` 可解析，`start < end`。
- `end > now`（拒绝 9/13 这类已过期日期，并返回 `today` 锚点）。
- 时长 ≤ 30 天。
- 固定类型必须同一天，且落在 `start_time~end_time` 真实窗口内。
- `reason` 去空格后非空。
- `attachments` 只能引用**本轮消息或当前草稿**的附件，最多 6 个；不能复用历史请假证明。
- 返回结构化错误：`code / message / allowed_types / windows / today / hint`。

### 6.2 `cancel_leave / approve_leave`

- `id` 必须是正整数（拒绝 0、负数、小数、姓名）。
- `approve_leave.status` 只能是 1 或 2。

### 6.3 动态工具 schema

`toOpenAiTools(catalog, { leaveTypes })` 为 `apply_leave.type` 生成真实 `enum` + 窗口描述；`required` 增加 `reason`。
配置缓存 60s TTL（`loadLeaveConfig`），配置变更后最多 1 分钟重建；测试可 `clearLeaveConfigCache()`。

### 6.4 有限纠错

一轮对话内预校验失败最多 2 次：

1. 第 1 次：把结构化错误作为 tool 结果回给模型，允许改口/补字段；
2. 第 2 次：停止循环，给用户明确的失败原因（类型/窗口/今天/本次未执行），状态置 `failed`。

不会无限重试，也不会生成无法执行的确认卡片。

## 7. 确认版本与幂等

`AgentService.confirm`：

```sql
UPDATE agent_actions
SET status='executing', claim_token=?, claimed_at=NOW()
WHERE id=? AND user_id=? AND status='pending'
  AND expires_at > NOW() AND state_version=?
```

- `affectedRows=1` 才获得执行权；否则按最新行状态幂等回复：
  - `executed` → 「已经执行过，没有重复执行」
  - `superseded / invalidated` → 「信息已更新，请重新确认」
  - `executing` → 「正在执行，请勿重复提交」
  - `cancelled / failed / expired` → 对应说明
- 抢占成功后用**最新** `leave_config` 复验 `action.params`：
  - 预校验失败、`params_hash` 不符、`config_hash` 不符 → 标 `invalidated`，零副作用；
  - 通过才 `execute`；成功 `executed`，失败 `failed`。
- 生成新 action 前，同会话旧 `pending` 统一标 `superseded`（改口后旧卡片不能执行）。
- 确认成功把会话草稿置 `completed`；失败置 `failed` + `last_error`，允许用户补正。

日志：`confirm_conflict`、`preflight_failed`。

## 8. 附件生命周期

```
上传/入站落盘
  └─ registerAttachment(user_id, url, sha256, source)   # 未绑定会话
       └─ chat 前 authorize(user_id, url)                # 未登记/他人 → 403
            └─ bindAttachmentsToConversation(urls, conv) # 首次使用绑定会话
                 └─ 草稿 attachments 跨轮保留
                      └─ 本轮无新图 → 最多 2 张草稿图回送视觉模型
```

- App：`POST /api/agent/upload` 落盘后登记（`source='app'`）。
- 微信：`mediaIntake.saveInboundMedia` 落盘后登记（`source='weixin'`，sha256 取收到的原始字节）。
- `authorize` 严格：未登记或 `user_id` 不匹配都 403，错误码 `ATTACHMENT_NOT_REGISTERED / ATTACHMENT_NOT_OWNED`。
- 预校验再次限制 `apply_leave.attachments` 只能来自本轮/当前草稿，防止模型从历史消息里翻出旧证明。
- 新任务不继承旧附件；`completed` 后重新发起的申请从空附件开始。

## 9. 模型回退与视觉边界

`services/agent/vision.js`：

- `buildImageParts` 给每个图片块附 `_meta{name,url}`（内部字段，不发给上游）。
- 视觉上游前 `sanitizeParts` 剥掉 `_meta`，只保留 OpenAI 兼容的 `image_url`。
- 非视觉上游（如回落 DeepSeek）用 `stripImageParts` 生成：
  `[图片不可见：证明.png（/uploads/...）；当前模型不支持视觉，请让用户确认图片内容]`
  不再静默丢图，上下文仍在。
- 日志：`vision_unavailable`（只记张数/上游名，不记图片内容）、`llm_fell_back`。

## 10. 迁移、兼容与回滚

### 10.1 应用

```bash
cd backend
DB_NAME=class_manage_sys_test npm run migrate -- up
DB_NAME=class_manage_sys_test npm run migrate -- status   # 030 applied，待应用 0
```

迁移使用 `information_schema` 判断 + `CREATE TABLE IF NOT EXISTS`，可直接重复执行；已用测试库连续执行两次验证。

### 10.2 兼容

- App 不传 `conversationId` 的行为不变（创建新会话），只是渠道侧开始传。
- 旧会话 `state=NULL` → 空草稿；旧 action `*_hash=NULL` → 跳过哈希比较，仍做预校验。
- 旧代码不读新列/新表：回滚代码后新表列保留不影响运行。

### 10.3 回滚

1. 回滚应用代码到上一版本（新表/新列旧代码不读）。
2. **不删除** `agent_conversations.state/state_version/closed_at`、不删 4 张新表、不删 `agent_actions` 新列。
3. 如需清理运行期数据，只按测试/明确范围删除新增行；禁止 `DROP/TRUNCATE` 生产表。

## 11. 观测

结构化日志（不记录消息正文、图片内容、姓名）：

| event | 触发 |
|---|---|
| `session_rotated` | 渠道会话重置/过期/换绑 |
| `dedup_hit` | 重复入站 message_id 被跳过 |
| `preflight_failed` | 写候选预校验失败（code/attempt） |
| `confirm_conflict` | 抢占失败/复验失败 |
| `attachment_rejected` | 未登记/非本人附件 |
| `vision_unavailable` | 图片块被文本占位替代 |
| `llm_fell_back` | 模型上游回退 |

## 12. 测试证据（本次实跑）

环境：`backend`，`NODE_ENV=test`，`DB_NAME=class_manage_sys_test`，MySQL 8.0.46。

```text
$ npm run lint
✖ 14 problems (0 errors, 14 warnings)      # 全部为历史 warning，无 error

$ npx vitest run tests/unit tests/api
Test Files  43 passed (43)
     Tests  354 passed (354)

$ node tests/setup-test-db.js class_manage_sys_test   # 需要时重建测试库
$ DB_NAME=class_manage_sys_test NODE_ENV=test AGENT_LLM_MODE=mock \
  SELF_BASE_URL=http://127.0.0.1:3102 node tests/channel-smoke.js
渠道冒烟：PASS 15  FAIL 0
（连续 5 轮同一 conversationId、/新会话 轮换、重复确认幂等）

$ DB_NAME=class_manage_sys_test NODE_ENV=test node tests/fixtures.js
$ E2E_BASE=http://127.0.0.1:3103 node tests/e2e-acceptance.js
PASS: 108  FAIL: 0
（含真实上传落盘、只发附件对话、确认幂等；e2e 已按新语义更新）
```

新增/扩展用例（共 354 项）：

- `tests/unit/agentPreflight.test.js`：数字 type、过期日期、固定窗口、跨天、反向区间、>30 天、空事由、附件来源、销假/审批 id/status、动态配置哈希、参数哈希稳定性。
- `tests/unit/agentTaskState.test.js`：同工具合并、新值覆盖、附件去重、换工具/完成不继承、失败可补正、确认完成、草稿附件注入、prompt 块。
- `tests/unit/agentChannelSession.test.js`：连续续接、`/新会话` 轮换、12h 过期、A/B 换绑、解绑关闭、状态乐观锁、入站去重、附件 owner 403。

- `tests/api/agentHarness.test.js`：数字 type/错误窗口两次纠错后明确失败；补图→缺事由→补正→附件保留→确认成功（真实调用请假 API）；并发确认只执行一次；改口 supersede 旧 action 且确认被拒；配置哈希变化 invalidated；流式 pending；A/B 确认与附件隔离。
- `tests/channel-smoke.js`：渠道链路 15 项断言。
- `tests/unit/vision.test.js`：图片占位与 `_meta` 清理。

## 13. 未验证项与剩余风险

1. **未部署、未重启生产**：本次只提交代码/迁移/测试，未对 `/srv/apps/class-mansys` 执行迁移或重启；线上仍是 `410f319` 旧行为。部署需按 `docs/OPERATIONS.md` 单独授权。
2. **未用真实微信账号回放**：渠道链路用 `AGENT_LLM_MODE=mock` + 测试库验证；真实 iLink 的 `msg_id` 字段名可能是 `msg_id/message_id/id`，代码已做兼容，但未在真实下行消息上验证。没有稳定 id 时**不去重**，宁可不吞消息。
3. **模型视觉内容未复验**：图片是否识别正确仍取决于模型；本次只保证图片能送到视觉上游、回退时有占位，不保证 OCR 正确。
4. **App 前端未展示草稿状态**：前端未改；`state` 只在后端与 prompt 生效，App 仍按原消息/确认卡片交互。
5. **执行中崩溃**：confirm 抢占后进程崩溃会留下 `status='executing'`。当前不自动回收，需要人工/后续定时任务处理；这是有意的保守选择（避免重复执行）。
6. **配置缓存 60s**：管理员改 `leave_config` 后最多 1 分钟生效；期间确认会因 `config_hash` 变化被作废（零副作用），不会按旧配置执行。
7. **附件 URL 全局唯一**：媒体文件名由 `mediaService.uniqueName` 保证；若未来出现同 URL 复用，`ON DUPLICATE KEY` 只更新元数据、不转移 owner（保守，避免所有权被覆盖）。
8. **真实并发压测未做**：并发确认用 2 个 Promise 验证，未做多进程/高并发压测。

## 14. 涉及文件

- 迁移：`backend/migrations/030_agent_harness.sql`
- 仓储：`backend/services/agent/repo.js`
- 渠道会话：`backend/services/agent/channelSession.js`、`backend/services/channel/channelService.js`、`backend/services/channel/ilinkClient.js`、`backend/scripts/ilink-worker.js`
- 草稿/预校验/确认：`backend/services/agent/taskState.js`、`backend/services/agent/preflight.js`、`backend/services/agent/agentService.js`
- 提示词/工具 schema：`backend/services/agent/persona.js`、`backend/services/agent/toolCatalog.js`
- 回退：`backend/services/agent/vision.js`、`backend/services/agent/llm.js`
- 附件：`backend/services/agent/attachmentAuth.js`、`backend/routes/agent.js`、`backend/services/channel/mediaIntake.js`
- 上传目录兜底：`backend/config/multer.js`（全新 checkout 没有 `uploads/` 时自动创建，避免上传 500）
- 测试：`backend/tests/unit/agentPreflight.test.js`、`agentTaskState.test.js`、`agentChannelSession.test.js`、`tests/api/agentHarness.test.js`、`tests/channel-smoke.js`、`tests/e2e-acceptance.js`、`tests/unit/vision.test.js`
