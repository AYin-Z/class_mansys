# MCP 接入：让你自己的 AI 助手用上本系统

## 0. 一句话逻辑

**令牌 = 你在本系统的"身份副本"**（不是 API key 那种万能钥匙）。
你把它交给自己的 AI 客户端，客户端就能**以你的身份**调用本系统的能力；
系统对它的约束和你在 App 里手动操作**完全一样**：同一套权限矩阵、同一套区队/中队作用域、
写操作同样要你二次确认、每一步都记审计。

```
你的 AI 客户端（Claude Desktop / Cursor / DSH …）
        │  MCP 协议（JSON-RPC over HTTP，带 Authorization: Bearer cm_xxx）
        ▼
  https://<域名>/api/mcp          ← 无状态 MCP 端点，不需要在客户端装任何东西
        │  ① 校验令牌 sha256 → 找到令牌所属用户
        │  ② 以该用户身份签发**内部 JWT**
        ▼
  后端 REST API（/api/leave、/api/points …）
        │  权限矩阵 + 作用域 + zod 校验 + 写操作两阶段确认 + 审计
        ▼
      真实数据（只返回这个人本来就该看到的内容）
```

关键点：MCP **没有任何绕过通道**。它拿到的最多是"和你一样的权限"，不会更多。

## 1. 三步用起来

1. App →「办事助手 → 微信 / MCP 接入 → MCP 令牌」→ 填备注 → 点**生成令牌**（明文只显示一次）；
2. 勾选/不勾选「允许写操作」：
   - 不勾 = **只读**（38 个查询工具：查请假、考勤、账单、通知、名册…）；
   - 勾上 = **读写**（47 个业务工具 + 1 个 `cm_agent_confirm`，多出请假申请、报销、审批等）；
     写操作**不会直接落库**：写工具返回 `{status:'pending_confirmation', actionId, preview}`，必须再调用 `cm_agent_confirm` 传 `actionId` 才真正执行（默认 5 分钟过期）；
3. 复制页面给出的配置，粘到 AI 客户端的 MCP 设置里，重启客户端即可。

页面上的「**连接自检**」按钮能就地验证令牌（显示"连接正常：38 个工具 · 只读"），不用等装好客户端。

## 2. 客户端配置

### 2.1 HTTP 模式（推荐，所有人的用法）

只需要 URL + 令牌，**不需要克隆仓库、不需要装 Node、不需要数据库**：

```json
{
  "mcpServers": {
    "class-mansys": {
      "url": "https://cls.ayinserver.xin/api/mcp",
      "headers": { "Authorization": "Bearer cm_你的令牌" }
    }
  }
}
```

- 支持 Streamable HTTP 的客户端（较新版 Claude Desktop / Cursor / 各类 SDK）直接用上面的写法；
- 只支持 stdio 的老客户端，可用 `mcp-remote` 之类的桥接：
  `npx -y mcp-remote https://cls.ayinserver.xin/api/mcp --header "Authorization: Bearer cm_你的令牌"`
- 也支持 `x-api-key: cm_你的令牌` 头（某些客户端只让填 key）。

### 2.2 stdio 模式（仅当客户端和服务器在同一台机器）

```json
{
  "mcpServers": {
    "class-mansys": {
      "command": "node",
      "args": ["/home/ayin/Current_Works/class_mansys/backend/mcp/server.js"],
      "env": { "CM_API_TOKEN": "cm_你的令牌" }
    }
  }
}
```

stdio 版会在本机读数据库校验令牌，因此**必须在服务器上运行**；给同学用请用 HTTP 模式。

## 3. 验证与排障

```bash
# 自检（不需要客户端）
curl -s -H "Authorization: Bearer cm_xxx" http://127.0.0.1:3002/api/mcp/info

# 真·MCP 客户端冒烟（HTTP）
CM_TOKEN=cm_xxx node backend/tests/mcp-http-smoke.mjs
# 真·MCP 客户端冒烟（stdio，需在服务器上）
CM_TOKEN=cm_xxx node backend/tests/mcp-smoke.mjs

# 单测
cd backend && npx vitest run tests/api/mcpRoutes.test.js tests/unit/mcpTools.test.js
```

| 现象 | 原因 |
|---|---|
| 401 令牌无效或已吊销 | 令牌被吊销/写错/环境变量没生效 |
| 客户端报 406 | 请求头缺少 `Accept: application/json, text/event-stream`（客户端过老） |
| 405 | 对无状态端点用了 GET/DELETE（不支持 SSE 订阅与会话删除） |
| 工具比预期少 | 令牌是只读的，写工具需要勾选「允许写操作」后**重新生成令牌**（作用域不可改） |

## 4. 安全设计（为什么敢把令牌给外部 agent）

| 机制 | 说明 |
|---|---|
| 明文只存一次 | 库里只有 `sha256(token)`，泄露数据库也拿不到可用令牌 |
| 前缀可辨认 | 列表只显示 `cm_xxxxxxx…` 前缀 + 最近使用时间，便于发现异常 |
| 作用域 | `allow_write` 存在令牌上（迁移 014）；只读令牌**永远**拿不到写工具 |
| 身份等价 | 每次调用都换成该用户的内部 JWT 走 REST，权限矩阵与作用域全量生效 |
| 二次确认 | 写工具只生成 `agent_actions` 待确认动作，必须再调 `cm_agent_confirm` 才落库，默认 5 分钟过期 |
| 可吊销 | App 内一键吊销，下一次调用立刻 401 |
| 审计 | 审计记录带 `x-agent`，可查"这条数据是谁的 agent 动的" |

## 5. 工具是怎么来的

工具目录由 Express 路由表**自动生成**（`services/agent/toolCatalog.js` → `services/mcp/mcpTools.js`），
命名统一 `cm_` 前缀；新增业务接口会自动出现在 MCP 里，无需手工维护。
`/api/agent/*` 与 `/api/mcp/*` 自身不会暴露为工具（避免递归）。
