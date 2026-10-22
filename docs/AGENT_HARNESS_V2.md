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
- 首条消息并发：两个请求同时看不到 session 时，只有唯一键赢家能落库；输家关闭自己刚建的会话并复用赢家，不把 `ER_DUP_ENTRY` 冒给用户。
- 入站去重：先 `INSERT IGNORE` 占位；处理抛错/业务失败时 `clearInboundSeen` 释放占位，iLink 重投可真正重试（at-least-once），确认幂等兜住重复执行。
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

1. 只有**同一 tool（模块工具还要求同一 action）且状态为 collecting/awaiting_confirm/failed** 时才继承旧字段。
2. 模型本轮显式给出的值覆盖旧值（包括空数组/空字符串用于清空）；没给的字段保留。
3. `mergeArgs()` 会把草稿字段**真正并入 preflight 与 action 参数**：curated 合并到顶层，module 合并到 `params`，并保留 `action`；不是只注入 prompt。
4. 附件单独存放，不写进 `fields`；默认按 URL 去重累积。模型显式给 `attachments`（含 `[]`）时是**权威替换值**，可替换/清空。
5. 换工具、换 action、`completed` 后重新发起 → 开新草稿，**不继承旧附件**（避免把上一次请假的证明挂到新申请）。
6. 用户先补图但还没说办什么时，允许 `tool=null` 的 collecting 草稿承载附件；后续选工具时继承附件、不继承字段。
7. 每次草稿变更 `state_version + 1`；写工具缺字段时也会落草稿，下一轮仍能续上。

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
UPDATE agent_actions a
LEFT JOIN agent_conversations c ON c.id = a.conversation_id
SET a.status='executing', a.claim_token=?, a.claimed_at=NOW()
WHERE a.id=? AND a.user_id=? AND a.status='pending'
  AND a.expires_at > NOW() AND a.state_version=?
  AND (a.conversation_id IS NULL OR (
       c.id IS NOT NULL AND c.closed_at IS NULL AND c.state_version = a.state_version
  ))
```

**版本自增语义**：`createPendingAction` 先把会话推进到 `awaiting_confirm`（`state_version` 从 V 变 V+1），再用 V+1 创建 action。因此 `action.state_version === conversation.state_version`，确认时可在同一条 UPDATE 里原子校验二者相等。

**原子边界**：抢占动作、会话版本、`closed_at` 在同一个 UPDATE JOIN 中判定；只要本轮消息改口/补图/预校验失败/会话重置推进了版本或关闭了会话，旧 action 的 affectedRows 必为 0。抢占失败后再读最新 action/conversation 做幂等分类。

- `affectedRows=1` 才获得执行权；否则按最新行状态幂等回复：
  - `executed` → 「已经执行过，没有重复执行」
  - `superseded / invalidated` → 「信息已更新，请重新确认」
  - `executing` → 「正在执行，请勿重复提交」
  - `cancelled / failed / expired` → 对应说明
- 抢占成功后用**最新** `leave_config` 复验 `action.params`：`preflight.validate({ freshConfig: true })` 绕过 60s 缓存。
  - 预校验失败、`params_hash` 不符、`config_hash` 不符 → 标 `invalidated`，零副作用；
  - 通过才 `execute`；成功 `executed`，失败 `failed`。
- **任何新的 chat/渠道入站轮次**（即使模型没有生成新卡片）都会先把旧 `pending` 标 `superseded`、把草稿状态改回 `collecting` 并推进 `state_version`；补图、改口、预校验失败都不会留下可执行旧卡。
- 会话 `closed_at`（`/新会话`、解绑、12h/7d 轮换）会作废旧 pending；确认返回 `CONVERSATION_CLOSED`。
- 取消：worker/网关把 action 标 `cancelled`；确认返回 `ACTION_CANCELLED`，不执行。
- 生成新 action 前，同会话旧 `pending` 统一标 `superseded`。
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
- **替换**：模型在 `attachments` 里显式给出新列表（curated 顶层 / module `params.attachments`）时按权威值替换，不再与旧草稿合并。
- **撤回**：显式 `attachments: []` 清空；用户发送 `/撤回附件 | /清除附件 | /删除附件` 时不调用模型，直接清空草稿附件、作废旧确认卡片。
- **无工具轮次补图**：即使模型这一轮只回文字，`prepareTurn` 也会把本轮附件并入草稿（`tool=null` 的 collecting 草稿），并推进版本使旧确认失效。

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
✖ 13 problems (0 errors, 13 warnings)      # 全部为历史 warning，无 error

$ NODE_ENV=test DB_NAME=class_manage_sys_test JWT_SECRET=test_secret_1234567 npm test
Test Files  43 passed (43)
     Tests  373 passed (373)

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

新增/扩展用例（共 373 项）：

- `tests/unit/agentPreflight.test.js`：数字 type、过期日期、固定窗口、跨天、反向区间、>30 天、空事由、附件来源、销假/审批 id/status、动态配置哈希、参数哈希稳定性。
- `tests/unit/agentTaskState.test.js`：同工具合并、新值覆盖、附件去重、换工具/完成不继承、失败可补正、确认完成、草稿附件注入、prompt 块、`mergeArgs` curated/module 嵌套、模块 action 隔离、附件替换/清空、tool=null 补图草稿。
- `tests/unit/agentChannelSession.test.js`：连续续接、`/新会话` 轮换、12h 过期、A/B 换绑、解绑关闭、状态乐观锁、入站去重、附件 owner 403。

- `tests/api/agentHarness.test.js`：数字 type/错误窗口两次纠错后明确失败；补图→缺事由→补正→附件保留→确认成功（真实调用请假 API）；并发确认只执行一次；改口 supersede 旧 action 且确认被拒；配置哈希变化 invalidated；流式 pending；A/B 确认与附件隔离；**跨 chat/微信入站多轮续接**；改口无新卡/预校验失败/取消/重置/closed_at；草稿字段跨轮并入 curated 与 module 参数；确认强制最新配置；无工具补图；附件替换/清空/`/撤回附件`。
- `tests/channel-smoke.js`：渠道链路 15 项断言。
- `tests/unit/vision.test.js`：图片占位与 `_meta` 清理。

## 13. CI 证据

PR：https://github.com/AYin-Z/class_mansys/pull/1

CI run `39793351570`（并发/去重补修代码 `24231d2`）：

| job | 结果 | 说明 |
|---|---|---|
| backend | pass | `npm run lint` + `npm test`（373 项） |
| frontend | pass | 未改前端，沿用既有门禁 |
| ui-smoke | pass | 未改 UI |
| agent-eval | pass | 工具选择门禁 90% 通过（前次 306/330 = 92.7%）；多步行为 7/9=77.8% 为观测项 |

说明：本分支同时修正了评测工具表（`tests/eval/run.mjs`、`multistep.mjs`）使用真实 `leave_config` 生成 `apply_leave.type` enum，并在工具描述中明确「不要先调 GET /api/leave/types」，工具选择评测稳定在 92.7%~93%；本次 CI 四项均 pass。

## 14. Hermes 独立验收补修（RED → GREEN）

Hermes 验收指出 5 类问题，均已先用失败用例复现，再修复到绿：

### 14.1 RED（修复前）

```text
$ NODE_ENV=test DB_NAME=class_manage_sys_test ... npx vitest run tests/api/agentHarness.test.js -t "RED→GREEN"
Test Files  1 failed (1)
     Tests  11 failed | 7 skipped (18)
```

典型失败：

- 草稿第二轮只给 `reason` → `pendingAction=null`（字段只进 prompt，没进 preflight/action）；
- 模块工具 `leave` 的 `params` 未合并草稿字段；
- 动作创建后 `action.state_version` 比 `conversation.state_version` 小 1；
- 改口无新卡后旧 action 仍 `pending`，confirm 直接执行成功；
- 预校验失败后旧 action 仍可确认；
- 关闭会话后 confirm 仍执行成功；
- 修改 `leave_config` 后 confirm 吃 60s 缓存，仍按旧窗口执行；
- 无工具轮次补图后草稿附件为空、旧确认仍有效；
- 显式 `attachments:[B]`/`[]` 仍与旧附件合并；
- `/撤回附件` 未生效；
- 跨 chat/微信多轮第二轮拿不到合并后的 pending。

### 14.2 GREEN（修复后）

```text
$ npx vitest run tests/api/agentHarness.test.js -t "RED→GREEN"
Test Files  1 passed (1)
     Tests  11 passed | 7 skipped (18)

$ npx vitest run tests/api/agentHarness.test.js
Test Files  1 passed (1)
     Tests  20 passed (20)

$ npm test
Test Files  43 passed (43)
     Tests  373 passed (373)
```

### 14.3 修复点

1. `taskState.mergeArgs()`：草稿字段真正并入 curated 顶层 / module `params`；模块工具按 `action` 隔离，避免 apply 字段串到 cancel/approve。
2. `createPendingAction`：先 `markState` 推进到 `awaiting_confirm` 得到 V+1，再用 V+1 建 action；确认的 UPDATE JOIN 同时校验 `action.state_version = conversation.state_version` 与 `closed_at IS NULL`。
3. 任何新 chat/渠道轮次先作废旧 pending、把草稿改回 collecting 并推进版本；旧卡无处可逃。
4. `confirm` 使用 `preflight.validate({ freshConfig: true })` 强制读最新 `leave_config`。
5. 无工具轮次也会把本轮附件写入草稿；显式 `attachments` 为权威替换值（`[]` 即清空），但仍逐条校验 `agent_attachments` owner（模型塞他人 URL 也 403）；`/撤回附件` 直接清空并作废旧卡。
6. DB 依赖用例改为 fail-loud：`DB_NAME=class_manage_sys_test_missing` 时直接抛「测试库不可用…」而不是 7 个 skip。
7. 新增真实跨 chat/微信入站多轮：同一 `conversationId` 经 `ChannelService.handleInbound` 与 `AgentService.chat` 交替续接，草稿合并、确认只执行一次。
8. 渠道会话首条消息并发 unique 冲突：输家关闭自建会话并复用赢家，不抛 `ER_DUP_ENTRY`。
9. 入站去重占位在工作流失败/业务失败时释放，允许 iLink 重投真正重试；`agent_inbound_dedup` 单测覆盖 mark→clear→mark。

### 14.4 并发原子边界

```sql
UPDATE agent_actions a LEFT JOIN agent_conversations c ON c.id = a.conversation_id
SET a.status='executing', a.claim_token=?, a.claimed_at=NOW()
WHERE a.id=? AND a.user_id=? AND a.status='pending' AND a.expires_at>NOW()
  AND a.state_version=?
  AND (a.conversation_id IS NULL OR (
       c.id IS NOT NULL AND c.closed_at IS NULL AND c.state_version=a.state_version))
```

动作、会话版本、关闭状态在同一行级 UPDATE 中判定；并发确认只有一个 affectedRows=1，其余按 executed/superseded/invalidated/cancelled/expired/closed 幂等回复。

此外，`saveConversationState` 的 CAS 带 `NOT EXISTS (executing within 5min)`：确认已抢占时，新轮次无法推进会话版本（返回 409 `CONVERSATION_BUSY`）；改口先到则确认的 UPDATE JOIN 看到新版本而失败。两者不会同时成立，且不跨 HTTP 持长事务。5 分钟只是进程崩溃后的解锁窗口。

## 15. 未验证项与剩余风险

1. **未部署、未重启生产**：本次只提交代码/迁移/测试，未对 `/srv/apps/class-mansys` 执行迁移或重启；线上仍是 `410f319` 旧行为。部署需按 `docs/OPERATIONS.md` 单独授权。
2. **未用真实微信账号回放**：渠道链路用 `AGENT_LLM_MODE=mock` + 测试库验证；真实 iLink 的 `msg_id` 字段名可能是 `msg_id/message_id/id`，代码已做兼容，但未在真实下行消息上验证。没有稳定 id 时**不去重**，宁可不吞消息。去重改为失败释放占位（at-least-once），极端情况下重复处理由确认幂等兜底。
3. **模型视觉内容未复验**：图片是否识别正确仍取决于模型；本次只保证图片能送到视觉上游、回退时有占位，不保证 OCR 正确。
4. **App 前端未展示草稿状态**：前端未改；`state` 只在后端与 prompt 生效，App 仍按原消息/确认卡片交互。
5. **执行中崩溃**：confirm 抢占后进程崩溃会留下 `status='executing'`。当前不自动回收 action，但会话状态 CAS 的 5 分钟窗口会让会话重新可写；建议后续加定时任务把超时 executing 标 failed（避免永久占用）。
6. **配置缓存 60s**：管理员改 `leave_config` 后最多 1 分钟生效；期间确认会因 `config_hash` 变化被作废（零副作用），不会按旧配置执行。
7. **附件 URL 全局唯一**：媒体文件名由 `mediaService.uniqueName` 保证；若未来出现同 URL 复用，`ON DUPLICATE KEY` 只更新元数据、不转移 owner（保守，避免所有权被覆盖）。
8. **真实并发压测未做**：并发确认用 2 个 Promise 验证，未做多进程/高并发压测。

## 16. 涉及文件

- 迁移：`backend/migrations/030_agent_harness.sql`
- 仓储：`backend/services/agent/repo.js`
- 渠道会话：`backend/services/agent/channelSession.js`、`backend/services/channel/channelService.js`、`backend/services/channel/ilinkClient.js`、`backend/scripts/ilink-worker.js`
- 草稿/预校验/确认：`backend/services/agent/taskState.js`、`backend/services/agent/preflight.js`、`backend/services/agent/agentService.js`
- 提示词/工具 schema：`backend/services/agent/persona.js`、`backend/services/agent/toolCatalog.js`
- 回退：`backend/services/agent/vision.js`、`backend/services/agent/llm.js`
- 附件：`backend/services/agent/attachmentAuth.js`、`backend/routes/agent.js`、`backend/services/channel/mediaIntake.js`
- 上传目录兜底：`backend/config/multer.js`（全新 checkout 没有 `uploads/` 时自动创建，避免上传 500）
- 测试：`backend/tests/unit/agentPreflight.test.js`、`agentTaskState.test.js`、`agentChannelSession.test.js`、`tests/api/agentHarness.test.js`、`tests/channel-smoke.js`、`tests/e2e-acceptance.js`、`tests/unit/vision.test.js`
