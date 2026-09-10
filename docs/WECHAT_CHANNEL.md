# 在微信里使用办事助手（个人微信 · iLink Bot API）

> 已实现：本系统**直连 iLink Bot API**（Hermes 用的同一套协议），不依赖任何第三方网关。
> 你在微信里私聊助手，消息经长轮询 worker 转成站内 Agent 调用，**权限、二次确认、审计与站内完全一致**。

## 1. 能力与限制（先看这里）

| 项目 | 现状 |
|---|---|
| 私聊（1v1） | ✅ 支持。绑定后直接说事：「我要请明天的早操假」「今天中队出勤怎么样」 |
| 普通微信群 | ❌ 不支持。iLink 拿到的是**机器人身份**，多数群事件不下发，加不进普通群 |
| 写操作 | ✅ 支持，但**必须二次确认**：助手回「回复**确认**执行，或回复**取消**放弃」 |
| 高危操作 | 与站内一致受权限矩阵限制（普通同学看不到审批入口，干部才有） |
| 稳定性 | 非官方通道，协议可能变更；worker 断线自动重连，站内页始终是主入口 |

## 2. 架构

```
用户微信 ⇄ iLink Bot API (https://ilinkai.weixin.qq.com)
                ↑ 长轮询 getupdates（~35s 挂起）/ sendmessage
        scripts/ilink-worker.js  （systemd: class-mansys-ilink.service）
                │  /绑定 <码>  → ChannelService.bind → agent_channel_bindings
                │  普通消息     → ChannelService.handleInbound
                ▼
        AgentService.chat(用户身份, 内部 JWT) → 同一套工具/权限/二次确认/审计
```

关键设计：
1. **身份绑定**：站内「办事助手 → 微信助手」生成 6 位绑定码（15 分钟、一次性），在微信里发 `/绑定 码`；
2. **身份等价**：worker 用绑定关系为用户签发**站内 JWT** 再调用 Agent，不复制任何权限逻辑；
3. **游标持久化**：`channel_state.sync_buf` 保存 `get_updates_buf`，重启不重复消费；
4. **待确认动作**：worker 进程内按外部用户记住 `actionId`，微信回复「确认」走 `ChannelService.confirm`。

## 3. 部署步骤

### 3.1 推荐：在 App 内扫码（超管，无需登录服务器）

打开「办事助手 → 微信助手 / MCP 接入 → 连接微信机器人」，点「生成二维码并连接」，用微信扫码并在手机上确认。

- 二维码由 `POST /api/agent/channel/bot-login/start` 生成（服务端 `qrcode` 库渲染成 data URL，5 分钟有效）；
- 页面每 2.5 秒轮询 `GET /api/agent/channel/bot-login/status`：`wait → scaned → confirmed`；
- 确认后凭证写入 `WEIXIN_CREDENTIALS_FILE`（默认 `~/.class-mansys/weixin.json`，600），并自动 `systemctl --user restart class-mansys-ilink` 拉起 worker；
- 权限：`MANAGE_CHANNEL`（仅超管 role=8），非超管调用返回 403。

### 3.2 等价：命令行扫码（首次装机器/排障用）

```bash
# 1) 扫码登录，拿到 account_id / token（保存到 ~/.class-mansys/weixin.json，权限 600）
cd backend && node scripts/ilink-login.js

# 2) 起 worker（前台验证）
node scripts/ilink-worker.js

# 3) 常驻（用户级 systemd；未登录微信时脚本 exit 0，不会空转重启）
cp ops/systemd/class-mansys-ilink.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now class-mansys-ilink
journalctl --user -u class-mansys-ilink -f
```

若扫码得到的 `baseurl` 与默认不同（出现 `scaned_but_redirect`），登录脚本会自动跟随并写入凭证文件；
也可用 `WEIXIN_ACCOUNT_ID` / `WEIXIN_TOKEN` / `WEIXIN_BASE_URL` 环境变量覆盖。

## 4. 协议要点（复刻 Hermes 实现，便于排障）

- 端点：`ilink/bot/getupdates`、`sendmessage`、`getconfig`、`getuploadurl`、`get_bot_qrcode`、`get_qrcode_status`；base `https://ilinkai.weixin.qq.com`；
- 请求头：`AuthorizationType: ilink_bot_token`、`Authorization: Bearer <token>`、`X-WECHAT-UIN: base64(随机 uint32)`、`iLink-App-Id: bot`、`iLink-App-ClientVersion: 131584`；
- 请求体：业务字段 + `base_info: { channel_version: "2.2.0" }`；
- 发消息：`{ to_user_id, client_id, message_type: 2, message_state: 2, item_list: [{ type: 1, text_item: { text } }], context_token }`（`context_token` 必须回显该会话最后一次的值）；
- 收消息：游标 `get_updates_buf` 每次响应更新并落库；文本取 `item_list[].text_item.text`（`type === 1`）。

单测覆盖协议构造：`backend/tests/unit/ilinkClient.test.js`。

## 5. 风险与合规

- iLink 属**非官方**通道，存在协议变更、限流、账号风险；建议只用个人小号作为**机器人身份**；
- 消息内容会经过微信与 iLink 服务，请勿在微信里传输密码等敏感信息；
- 建议只开放只读查询 + 低风险写操作（请假、建议）；审批类操作虽与站内同权，仍建议优先在站内完成；
- 渠道不可用时站内功能不受影响（同一 AgentService，互不依赖）。
