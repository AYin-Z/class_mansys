# 对话式 Agent（办事助手）

> 目标：每个人除了手动点页面，还能用对话完成**系统内一切手动可达的功能**。

## 1. 设计原则

1. **不放大权限**：Agent 以「当前用户身份」执行，权限=该用户手动权限；区队/中队作用域、zod 校验、操作审计全部复用现有中间件。
2. **写操作两阶段确认**：模型只能发起 `propose`，用户在聊天里点「确认执行」或回复确认后才真正落库；动作 5 分钟过期、一次性、幂等。
3. **能力由路由表生成**：工具目录从 Express 挂载表自动生成，`手动可达 = 对话可达`，新增路由自动出现在能力清单里，不会漏。
4. **可降级**：没有 `LLM_API_KEY` 时自动进入 `mock`（规则匹配）模式，保证离线/无密钥也能演示与自动化测试；`off` 则显式 503。

## 2. 架构

```
Vue /pages/agent  →  POST /api/agent/chat
                        │
                        ▼
                  AgentService（服务端编排）
    ┌───────────────┼────────────────┬──────────────────┐
    │ llm.js        │ toolCatalog.js │ toolRunner.js    │ repo.js
    │ DeepSeek/兼容 │ 路由→工具+快捷  │ 以用户 JWT 回调  │ 会话/消息/动作
    └───────────────┴────────────────┴──────────────────┘
                        │ 内部 HTTP（同一套中间件）
                        ▼
                  /api/*（权限、作用域、校验、审计）
```

## 3. 工具覆盖（当前 39 个）

- **模块工具 19 个**：`leave / fee / notice / announcement / album / homework / psychological / challenge / vote / suggestion / lottery / points / admin / company / users / message / classes / app / auth`，每个工具的 `action` 枚举 = 该模块真实端点（共 129 个端点）。
- **快捷工具 20 个**：`my_leaves / apply_leave / cancel_leave / my_expenses / create_expense / my_points / points_ranking / list_notices / notice_detail / my_homework / submit_suggestion / company_attendance / company_leave_records / my_psychological / create_psychological / list_albums / list_votes / list_lotteries / list_challenges / my_profile`。

## 4. 配置（backend/.env）

```bash
# auto=有密钥走真实模型，无密钥降级 mock；mock=规则匹配；off=关闭
AGENT_LLM_MODE=auto
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=<你的 DeepSeek Key>
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_MS=30000
AGENT_MAX_STEPS=6          # 单轮最多工具调用轮数
AGENT_DAILY_QUOTA=200      # 每用户每天消息上限
AGENT_ACTION_TTL_MS=300000 # 待确认动作有效期（5 分钟）
SELF_BASE_URL=            # 留空自动用 http://127.0.0.1:$PORT
```

## 5. API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/agent/tools` | 能力清单（模块 + 快捷工具 + 端点总数） |
| POST | `/api/agent/chat` | 对话；读操作立即执行，写操作返回 `pendingAction` |
| POST | `/api/agent/confirm` | 确认并执行 `pendingAction`（仅本人、一次性、过期失效） |
| GET | `/api/agent/conversations` | 我的会话列表 |
| GET | `/api/agent/conversations/:id/messages` | 会话消息（仅本人） |

## 6. 安全与治理

- **越权防护**：工具执行走内部 HTTP，等同于用户自己点页面；`toolRunner` 对模块工具做 action 白名单校验（防路径注入），快捷工具只透传白名单字段。
- **审计**：所有写操作沿用 `operation_logs`；内部调用带 `x-agent: 1` 与 `x-agent-conversation`，便于区分「人工」与「对话」来源。
- **配额**：`agent_messages` 统计 24 小时用户消息数，超过 `AGENT_DAILY_QUOTA` 返回 429。
- **隐私**：Agent 只能读到该用户权限内的数据；会话与动作均按 `user_id` 隔离（E2E 已覆盖「他人不能确认我的动作 / 不能读我的会话」）。
- **提示注入**：模型只通过工具取数，不直接读库；写操作必须人工确认，因此注入导致的误操作不会静默落库。

## 7. 测试

- 单测（16 项）：工具目录生成与写标记、路径参数与白名单、防路径注入、mock 意图映射、模式降级。
- 端到端（8 项）：能力目录、读意图调用、写意图返回待确认、确认执行成功、重复确认 404、他人确认/读会话被拒。

## 8. 角色化能力（Phase B）

### 8.1 两套人设（`services/agent/persona.js`）

| 身份 | 定位 | 行为要点 |
|---|---|---|
| **干部（role 1-9）** | 管理助手，最大化分担事务 | 被问「今天有什么要处理」时**并行查询**待审批请假、待审批班费、中队出勤、当日请假明细，输出条目化简报（含 id/姓名/时间）；管理动作参数齐全就直接发起（系统弹确认卡片），批量操作**逐条确认**；提示高风险操作 |
| **学员（role 0）** | 使用引导 + 办事助手 | 问「怎么请假/怎么看通知/怎么交作业」时**优先调用 `system_guide`** 取权威步骤（步骤+页面路径），再问「需要我直接帮你提交吗」；能力内的事直接办 |

### 8.2 干部管理快捷工具（7 个）

`pending_leave_approvals`（待审批请假）、`pending_fee_approvals`（待审批班费）、`roster_search`（成员名册）、`publish_notice`（发通知，写）、`approve_leave`（审批请假，写）、`approve_expense`（审批班费，写）、`add_points`（积分加减，写）。

### 8.3 使用引导工具（本地工具，不查库）

`system_guide(topic)` 覆盖：请假 / 通知公告 / 作业 / 班费 / 建议箱 / 积分 / 心理 / 相册 / 投票抽奖擂台 / 账号 / 中队出勤，返回**步骤 + 页面路径**，保证回答口径统一、不编造。

### 8.4 流式输出与语音（Phase B/C）

- `POST /api/agent/chat/stream`（SSE）：`delta`（逐字）/ `tool`（调用工具）/ `pending`（待确认）/ `done` / `error` 事件；前端用 fetch + ReadableStream 解析，失败自动回退普通接口。
- 前端聊天页支持**语音输入**（浏览器 `SpeechRecognition`，不可用时按钮提示）。
- 模型：DeepSeek（`deepseek-chat`）已接通并验证；`AGENT_LLM_MODE=auto` 时无密钥自动降级 mock。

### 8.5 每日建议汇总邮件（Phase C 主动提醒）

- `services/suggestionDigest.js` 汇总最近 24h 建议 + 全库状态统计 + **近 24h 服务端 5xx 归类**（便于你第一时间打补丁）。
- `scripts/send-suggestion-digest.js` → 发送到 `SUGGESTION_DIGEST_TO`（当前 `2792715318@qq.com`），并落盘到 `/home/ayin/db_backups/digests/`。
- 已安装用户级 systemd timer：`class-mansys-digest.timer`（每日 08:00；`class-mansys-backup.timer` 每日 03:30）。
- **前置条件**：在 `backend/.env` 配置 SMTP（QQ 邮箱需用「授权码」而非登录密码）：
  ```bash
  SMTP_HOST=smtp.qq.com
  SMTP_PORT=465
  SMTP_SECURE=true
  SMTP_USER=2792715318@qq.com
  SMTP_PASS=<QQ邮箱授权码>
  MAIL_FROM=2792715318@qq.com
  SUGGESTION_DIGEST_TO=2792715318@qq.com
  ```
  未配置时定时任务仍会运行并落盘，日志提示「SMTP 未配置」。

## 9. 后续（下一阶段）

- 表单卡片回填（请假/报销结构化输入）；评测集与回归（固定问题集打分）；主动提醒扩展到「待审批 / 作业截止」（按人推送）。
- 主动提醒扩展到「待审批 / 作业截止」（按人推送）。
- 微信渠道增强：图片/语音消息、群聊（受 iLink 限制，暂不可行）。

## 10. 微信渠道（个人微信）

已实现直连 **iLink Bot API**（Hermes 同款协议），无需第三方网关：

- **超管扫码**：站内「办事助手 → 微信助手 / MCP 接入 → 连接微信机器人」生成二维码（`POST /api/agent/channel/bot-login/start`）→ 微信扫码确认 → 凭证落盘 + 自动拉起 worker（权限 `MANAGE_CHANNEL`，仅超管）；
- 同学侧：同一个面板生成 6 位绑定码（15 分钟一次性），微信私聊发 `/绑定 <码>`；
- `scripts/ilink-login.js` 扫码登录 → 凭证写入 `~/.class-mansys/weixin.json`（600）；
- `scripts/ilink-worker.js` 长轮询（systemd 用户单元 `class-mansys-ilink.service`，模板见 `ops/systemd/`）；
- 消息经 `ChannelService` → 同一 `AgentService`：权限/作用域/二次确认/审计完全一致；写操作回「确认」执行；
- **仅支持私聊**：iLink 机器人身份通常无法加入普通微信群。

细节、协议字段与风险说明见 `docs/WECHAT_CHANNEL.md`。

## 11. MCP（用户自带 agent 接入）

- `backend/mcp/server.js`（stdio）+ `services/mcp/mcpTools.js`：把路由表自动生成的工具暴露为 `cm_*` 工具；
- 认证用「个人访问令牌」（App 内生成 `cm_xxx`，服务端只存 sha256，可随时吊销），令牌等同本人身份，不绕过任何权限；
- **默认只读**（38 个工具），`CM_ALLOW_WRITE=1` 才暴露写工具（47 个）；写操作仍需 `cm_agent_confirm` 二次确认；
- 客户端配置示例与排障见 `docs/MCP.md`。
