#!/usr/bin/env node
/**
 * MCP 服务端（stdio）：把区队管理系统的能力暴露给本机 MCP 客户端。
 *
 * 用法（在支持 MCP 的客户端里配置）：
 *   command: node
 *   args: ["<repo>/backend/mcp/server.js"]
 *   env:  { "CM_API_TOKEN": "<在 App 里生成的个人访问令牌>" }
 *
 * 注意：stdio 模式在本机运行，需要能访问数据库与后端（通常就是服务器本身）。
 * 普通用户请改用 **HTTP 模式**：客户端里直接填 https://<域名>/api/mcp + 令牌，见 docs/MCP.md。
 *
 * 可选环境变量：
 *   CM_BASE_URL     内部 API 地址（默认 http://127.0.0.1:$PORT）
 *   CM_ALLOW_WRITE  设为 "0" 可强制只读（只能收紧，不能放宽令牌作用域）
 */
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { env } = require('../config/env');
const { ApiTokenService } = require('../services/apiToken');
const User = require('../models/User');
const authService = require('../services/authService');
const { buildMcpServer } = require('../services/mcp/mcpServerFactory');

function log(...args) {
  console.error('[mcp]', ...args); // stdout 留给协议
}

(async () => {
  const token = process.env.CM_API_TOKEN || '';
  if (!token) {
    log('缺少 CM_API_TOKEN（请在 App 的「办事助手 → 微信 / MCP 接入」中生成后填入客户端配置）');
    process.exit(1);
  }
  if (process.env.CM_BASE_URL) env.SELF_BASE_URL = process.env.CM_BASE_URL;

  const verified = await ApiTokenService.verify(token);
  if (!verified) {
    log('令牌无效或已吊销');
    process.exit(1);
  }
  const user = await User.findById(verified.userId);
  if (!user) {
    log('令牌对应的用户不存在');
    process.exit(1);
  }

  const app = require('../app'); // 仅用于工具目录（app.js 不会在此进程 listen）
  const allowWrite = verified.allowWrite && process.env.CM_ALLOW_WRITE !== '0';
  const { server, tools } = buildMcpServer({ app, user, jwt: authService.signToken(user), allowWrite });

  await server.connect(new StdioServerTransport());
  log('已连接：用户=' + user.name + ' 角色=' + user.role + ' 工具=' + tools.length + ' 写操作=' + (allowWrite ? '开启' : '关闭'));
})().catch((e) => {
  log('启动失败：' + e.message);
  process.exit(1);
});
