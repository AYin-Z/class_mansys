# 在微信里使用办事助手（个人微信 · iLink Bot API）

> 已实现：本系统**直连 iLink Bot API**（Hermes 用的同一套协议），不依赖任何第三方网关。
> 你在微信里私聊助手，消息经长轮询 worker 转成站内 Agent 调用，**权限、二次确认、审计与站内完全一致**。

## 1. 能力与限制（先看这里）

| 项目 | 现状 |
|---|---|
| 私聊（1v1） | ✅ 支持。绑定后直接说事：「我要请明天的早操假」「今天中队出勤怎么样」 |
| 普通微信群 | ❌ 不支持。iLink 拿到的是**机器人身份**，多数群事件不下发，加不进普通群 |
| 低风险写操作 | ✅ 直接办，不打断（如提交匿名建议——最坏后果只是一条噪音） |
| 中风险写操作 | ✅ 回确认：「回复**确认**执行，或回复**取消**放弃」 |
| 高危写操作 | ✅ 需要**确认码**：「确认请回复：确认 3757」——见 §5.2，为什么不能只回「确认」 |
| 影响面 | ✅ 确认消息里带**后端查库得出的真实数字**（「全中队 215 人会立刻收到」），不让模型说 |
| 图片/文件/语音/视频 | ✅ **已实现收发**（`services/channel/ilinkMedia.js`）。收到的媒体落盘成系统附件（图片自动生成缩略图变体），语音直接用微信自带的转写文本；助手回复里的 Markdown 图片会真的发出去（最多 3 张） |
| 消息长度 | 单条上限 1800 字符，超出会截断（应显式截断并引导到 App，见 §7） |
| 权限 | 与站内一致受权限矩阵限制（普通同学看不到审批入口，干部才有） |
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
4. **待确认动作存在服务端**：worker 每次从库里查该用户最近一条仍有效的待确认动作
   （`AgentRepo.latestPendingAction`），微信回复「确认」走 `ChannelService.confirm`。
   早期版本把这个映射存在**进程内的 Map** 里，worker 一重启（`Restart=always`）就丢，
   用户回「确认」会被告知"没有待确认操作"——而卡片明明还在聊天记录里。

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

## 5. 交互设计（2026-09-12）

### 5.1 约束决定了设计

| 约束 | 后果 |
|---|---|
| **纯文本**，无按钮/卡片 | 不能照搬 App 的卡片 UI，"点一下确认"在微信里不存在 |
| **不渲染 Markdown** | `**粗体**`、`- 列表` 会原样显示成符号，`toPlainText()` 负责去壳 |
| 聊天记录是**流水** | 用户可能几分钟后才回来看，确认消息必须**自带上下文**，不能依赖"上面那条" |
| 只能收文本 | 图片被静默丢弃（§6） |

### 5.2 确认分级：成本要匹配风险

```
低风险 → 直接办，不打断
中风险 → 回复「确认」
高风险 → 回复「确认 3757」（4 位码）
```

**为什么高危不能只回「确认」两个字**：微信里回两个字比在 App 里点按钮还省事，
是"闭眼确认"最高发的场景。要求把码看一遍再打出来，成本极低，但对"顺手一点"有效。

**码怎么来的**：`ChannelService.confirmCode(actionId)` 由 actionId 派生
（`(id × 7919) % 10000`）——**稳定可复算、不需要额外存储**，worker 重启后同一个动作的码不变。

实际效果（用真实干部身份跑出来的）：

```
用户：发一条通知：明天早上8点集合
助手：需要你确认后才会执行：发布通知 —— 发布通知：明天早上8点集合

      ⚠ 全中队 215 人会立刻收到这条推送，发布后无法撤回

      这是高影响操作。确认请回复：确认 3757
      放弃请回复：取消
用户：确认
助手：这是高影响操作，为避免误触需要确认码。请回复：确认 3757
用户：确认 3757
助手：已发布。
```

### 5.3 为什么降噪在微信里更重要

微信是聊天场景，弹确认会直接打断对话流。而且**全都弹 = 全都不看**，
确认就失去了信号价值。判据不是"能不能撤销"，而是**最坏后果有多大**：

- 提交匿名建议 → 没有删除端点，但最坏只是一条噪音 → **auto，直接办**
- 销假 → 只影响自己，但后果是考勤状态 → **confirm，必须确认**

### 5.4 主动推送（微信的强项，待做）

聊天渠道真正的价值是**主动找到人**，而不是等用户来问。现有 `class-mansys-digest.timer`
已有发送通路，可承载：

| 事件 | 推给谁 | 时机 |
|---|---|---|
| 请假被批准/驳回 | 申请人 | 事件触发 |
| 有待审批请假 | 干部 | 固定时间**汇总一条**，不逐条轰炸 |
| 作业即将截止 | 未提交的人 | 截止前 N 小时 |
| 班费待缴 | 未缴的人 | 截止前 N 天 |

**推送纪律**（否则会被当骚扰，最后被屏蔽）：
- 每人每天主动推送 **≤ 2 条**，能合并就合并（3 条待审批 → 一条"你有 3 条待审批"）
- 推送必须**可操作**（"回复『确认』批准"），否则只发站内
- 允许用户**按类型关闭**推送

## 6. 已知缺口（要设计，不要假装没有）

1. ~~媒体收发未实现~~ → **已实现（2026-09-12）**，实现在 `services/channel/ilinkMedia.js` +
   `services/channel/mediaIntake.js`，测试见 `tests/unit/ilinkMedia.test.js`（11 个）。
   协议细节与两个易踩的坑记录如下（参考实现是 Hermes 的 `gateway/platforms/weixin.py`）：

   | 项 | 值 |
   |---|---|
   | item 类型 | `1` 文本 / `2` 图片 / `3` 语音 / `4` 文件 / `5` 视频 |
   | 上传端点 | `ilink/bot/getuploadurl`（参数 `filekey`/`rawfilemd5`/`filesize`/`aeskey`） |
   | 媒体通道 | **AES-128-ECB 加密的 CDN**：下载 `GET {cdn}/download?encrypted_query_param=…`；上传 `POST {cdn}/upload?encrypted_query_param=…&filekey=…`，密文为 body，响应头带 `x-encrypted-param` |
   | 密钥 | `aeskey` base64 解码后 16 字节（兼容 32 位 hex 字符串形式） |
   | 语音 | 微信侧带 `voice_item.text`（语音转文字），可直接当文本用 |

   **实现要点**：
   - 接收：下载 → AES 解密 → 落 `uploads/agent`（图片）或 `uploads/resources`（其他）→
     经 `mediaService.describe()` 生成缩略图变体并登记 `media_assets` → 作为附件交给 Agent
   - 发送：加密 → `getuploadurl` → POST 到 CDN → 取响应头 `x-encrypted-param` → 发 item
   - 语音：微信自带 `voice_item.text`（转写），无其他文字时直接当文本用
   - 下载/上传失败会**明确告诉用户**"这张图片没能接收成功，请在 App 里上传"，不再静默吞掉
   - 助手回复里的 Markdown 图片会真的发出去（单条最多 3 张，超出提示去 App 看）

   **两个坑（照抄 Hermes 注释，避免重踩）**：
   - `aes_key` 必须给 **base64(hex 字符串)**，不是 base64(原始 16 字节)——给错接收方显示灰块
   - 上传一律用 **POST**；对 `upload_full_url` 用 PUT 会在微信 CDN 上 404
2. **同时只有一条待确认动作**：要办两件事时只保留最新那条，前面那条被悄悄顶掉，
   应该明确提示。
3. **没有多选项交互**（如"选 1 批准 / 选 2 驳回"）：现在只能靠自然语言，
   加数字选项会增加心智负担，需要权衡。
4. **绑定依赖 App 生成绑定码**：纯微信用户走不通，需要有人先在 App 里操作。


## 7. 通知的可见范围（2026-09-12 新增选项）

通知/公告的可见范围由**作者作用域**决定（服务端盖章 `class_id`）：

| 身份 | 默认可见范围 |
|---|---|
| 学员 / 区队干部（role 0-7） | **本区队**（如 class=6 → 41 人） |
| 超管 / 辅导员（role 8-9） | **全中队**（class_id = NULL，215 人） |

**新增**：`audience: 'company'` 参数可显式发全中队，但需要新权限
`PUBLISH_NOTICE_COMPANY`（默认授予团支书 5、宣传委员 7、超管 8、辅导员 9）。

不给所有干部的理由：一旦人人可发全中队，任何人都能向 215 人推送，骚扰面和误发风险太大。
其他人需要时由超管在权限矩阵里单独授予。

无权限者传 `audience=company` 会被 **403 拒绝**（不会静默降级成本区队——静默降级会让
发送者以为发到了全中队）。

## 8. 风险与合规

- iLink 属**非官方**通道，存在协议变更、限流、账号风险；建议只用个人小号作为**机器人身份**；
- 消息内容会经过微信与 iLink 服务，请勿在微信里传输密码等敏感信息；
- 建议只开放只读查询 + 低风险写操作（请假、建议）；审批类操作虽与站内同权，仍建议优先在站内完成；
- 渠道不可用时站内功能不受影响（同一 AgentService，互不依赖）。
