#!/usr/bin/env node
/**
 * MCP 服务端（stdio）：把区队管理系统的能力暴露给用户自己的 agent。
 *
 * 用法（在支持 MCP 的客户端里配置）：
 *   command: node
 *   args: ["/home/ayin/Current_Works/class_mansys/backend/mcp/server.js"]
 *   env:  { "CM_API_TOKEN": "<在 App 里生成的个人访问令牌>" }
 *
 * 可选环境变量：
 *   CM_ALLOW_WRITE=1   开启写操作工具（默认只读；写操作仍受系统权限与业务规则约束）
 *   CM_BASE_URL        内部 API 地址（默认 http://127.0.0.1:$PORT）
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { env } = require('../config/env');
const { ApiTokenService } = require('../services/apiToken');
const User = require('../models/User');
const authService = require('../services/authService');
const { execute } = require('../services/agent/toolRunner');
const { buildTools } = require('../services/agent/toolCatalog');
const { buildMcpTools } = require('../services/mcp/mcpTools');

function log(...args) {
  console.error('[mcp]', ...args); // stdout 留给协议
}

(async () => {
  const token = process.env.CM_API_TOKEN || '';
  if (!token) {
    log('缺少 CM_API_TOKEN（请在 App 的「办事助手 → MCP 令牌」中生成后填入客户端配置）');
    process.exit(1);
  }
  if (process.env.CM_BASE_URL) env.SELF_BASE_URL = process.env.CM_BASE_URL;

  const userId = await ApiTokenService.verify(token);
  if (!userId) {
    log('令牌无效或已吊销');
    process.exit(1);
  }
  const user = await User.findById(userId);
  if (!user) {
    log('令牌对应的用户不存在');
    process.exit(1);
  }

  const app = require('../app'); // 仅用于工具目录（app.js 不会在此进程 listen）
  const catalog = buildTools(app);
  const allowWrite = process.env.CM_ALLOW_WRITE === '1';
  const tools = buildMcpTools(catalog, { allowWrite });

  const jwt = authService.signToken(user);
  const server = new McpServer({ name: 'class-mansys', version: '1.0.0' });

  for (const t of tools) {
    server.registerTool(
      t.name,
      { title: t.name, description: t.description, inputSchema: t.shape },
      async (args) => {
        try {
          const result = await execute(t.tool, args || {}, { token: jwt, userId: user.id });
          const text = JSON.stringify({ status: result.status, data: result.data }).slice(0, 12000);
          if (!result.ok) return { isError: true, content: [{ type: 'text', text }] };
          return { content: [{ type: 'text', text }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: '调用失败：' + e.message }] };
        }
      }
    );
  }

  await server.connect(new StdioServerTransport());
  log('已连接：用户=' + user.name + ' 角色=' + user.role + ' 工具=' + tools.length + ' 写操作=' + (allowWrite ? '开启' : '关闭'));
})().catch((e) => {
  log('启动失败：' + e.message);
  process.exit(1);
});
