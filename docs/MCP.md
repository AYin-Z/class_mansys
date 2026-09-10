# MCP 接入（把自己的 agent 接到本系统）

本系统内置一个 **MCP Server（stdio）**，把你个人账号在本系统里的能力暴露成标准 MCP 工具，
于是 Claude Desktop / Cursor / DSH 等任意支持 MCP 的客户端都能直接查你的请假、考勤、账单、通知……

> 安全前提：MCP 工具**以你的身份**执行，走的是同一套 `requirePermission` + 区队/中队作用域校验。
> 不会绕过任何权限，也不会多看到一条别人的数据。

## 1. 在 App 内生成令牌

「办事助手 → 微信助手 & MCP 接入 → MCP 令牌 → 生成令牌」。

- 令牌形如 `cm_xxxxxxxx…`，**只显示一次**，请立即保存；
- 服务端只存 sha256，无法找回，丢了就吊销重发；
- 令牌等同你的登录态，泄泄露 = 身份被盗用，请在「MCP 令牌」列表里随时吊销。

对应接口：`POST /api/agent/tokens`（创建）、`GET /api/agent/tokens`（列表）、`DELETE /api/agent/tokens/:id`（吊销）。

## 2. 配置客户端

在 MCP 客户端的配置里加入（把 `cm_...` 换成你的令牌）：

```json
{
  "mcpServers": {
    "class-mansys": {
      "command": "node",
      "args": ["/home/ayin/Current_Works/class_mansys/backend/mcp/server.js"],
      "env": {
        "CM_API_TOKEN": "cm_你的令牌",
        "CM_BASE_URL": "http://127.0.0.1:3002"
      }
    }
  }
}
```

Claude Desktop：`~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）
或 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）。
Cursor：`.cursor/mcp.json` 或全局 MCP 设置。

## 3. 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CM_API_TOKEN` | 必填 | 个人访问令牌（`cm_` 开头） |
| `CM_BASE_URL` | `http://127.0.0.1:3002` | 后端地址；外网用 `https://cls.ayinserver.xin` |
| `CM_ALLOW_WRITE` | 未设置（只读） | 设为 `1` 才暴露写操作工具 |
| `CM_TIMEOUT_MS` | `20000` | 单次工具调用超时 |

## 4. 工具清单

工具名统一前缀 `cm_`，由 Express 路由表**自动生成**（`services/agent/toolCatalog.js` → `services/mcp/mcpTools.js`），
因此新增业务接口会自动出现在 MCP 里，无需手工维护。

- 只读（默认暴露，38 个）：`cm_my_leaves`、`cm_leave`（GET）、`cm_company_attendance`、`cm_pending_leave_approvals`、`cm_my_expenses`、`cm_notices`、`cm_system_guide` 等；
- 写操作（需 `CM_ALLOW_WRITE=1`，共 47 个）：`cm_apply_leave`、`cm_submit_suggestion`、`cm_approve_leave`……

**写操作是两阶段的**：调用写工具只会生成一条「待确认动作」（`agent_actions`），
必须再调用 `cm_agent_confirm` 传入 `actionId` 才真正落库，超时（默认 5 分钟）自动作废。
这样即使模型乱来，也不会静默改数据。

## 5. 验证

```bash
# 只读工具数（默认）
CM_API_TOKEN=cm_xxx node backend/mcp/server.js   # 启动后由客户端握手；或：
node -e "const{Client}=require('@modelcontextprotocol/sdk/client/index.js');/* 见 tests/unit/mcpTools.test.js */"

# 单元测试
cd backend && npx vitest run tests/unit/mcpTools.test.js
```

## 6. 已知边界

- MCP Server 目前是 **stdio** 传输（本地客户端）；若要用远程 MCP（HTTP/SSE），需再包一层并加 TLS + 令牌校验；
- 令牌不区分只读/读写，写权限由服务端 `CM_ALLOW_WRITE` 统一控制（按客户端进程粒度）；
- 每次调用都会刷新 `last_used_at`，可在 App 内看到「最近使用」时间，便于发现异常。
