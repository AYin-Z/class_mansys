const express = require('express');
const router = express.Router();
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ApiTokenService } = require('../services/apiToken');
const User = require('../models/User');
const authService = require('../services/authService');
const { buildMcpServer } = require('../services/mcp/mcpServerFactory');
const { fail, ok } = require('../shared/http');
const logger = require('../config/logger');

/**
 * MCP over HTTP（Streamable HTTP，无状态模式）
 *
 * 这是给**普通用户**用的通道：客户端只需要一个地址 + 一个令牌，不需要装任何东西。
 *   URL:    https://<域名>/api/mcp
 *   Header: Authorization: Bearer cm_xxxxx
 *
 * 认证 → 找到令牌所属用户 → 以该用户身份签发内部 JWT → 工具照常走权限矩阵与作用域。
 * 令牌作用域（只读/读写）在这里决定暴露哪些工具；写操作仍是两阶段确认。
 */
async function mcpAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : String(req.headers['x-api-key'] || '').trim();
    if (!token) return fail(res, 401, '缺少个人访问令牌（Authorization: Bearer cm_xxx）', 'UNAUTHORIZED');
    const verified = await ApiTokenService.verify(token);
    if (!verified) return fail(res, 401, '令牌无效或已吊销', 'UNAUTHORIZED');
    const user = await User.findById(verified.userId);
    if (!user) return fail(res, 401, '令牌对应的用户不存在', 'UNAUTHORIZED');
    req.mcp = { user, allowWrite: verified.allowWrite, tokenId: verified.tokenId, jwt: authService.signToken(user) };
    return next();
  } catch (e) {
    return next(e);
  }
}

// 连接自检：确认令牌有效、能拿到多少工具、是否可写（前端/排障都用它）
router.get('/info', mcpAuth, (req, res) => {
  const app = req.app;
  const { tools } = buildMcpServer({ app, user: req.mcp.user, jwt: req.mcp.jwt, allowWrite: req.mcp.allowWrite });
  return ok(res, {
    user: { id: req.mcp.user.id, name: req.mcp.user.name, role: req.mcp.user.role },
    allowWrite: req.mcp.allowWrite,
    toolCount: tools.length,
    endpoint: '/api/mcp',
    tools: tools.map((t) => t.name)
  });
});

// MCP 协议端点（JSON-RPC：initialize / tools/list / tools/call ...）
router.post('/', mcpAuth, async (req, res) => {
  const { user, jwt, allowWrite } = req.mcp;
  let server;
  try {
    const built = buildMcpServer({ app: req.app, user, jwt, allowWrite });
    server = built.server;
    // 无状态模式：每个请求一套 server/transport，请求结束即释放
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    logger.warn({ err: e.message, userId: user.id }, 'mcp http request failed');
    if (!res.headersSent) fail(res, 500, 'MCP 调用失败：' + e.message, 'MCP_ERROR');
  }
});

// 无状态模式下不提供服务端推送 / 会话删除
router.get('/', (_req, res) => fail(res, 405, '该 MCP 端点无状态，不支持 SSE 订阅', 'METHOD_NOT_ALLOWED'));
router.delete('/', (_req, res) => fail(res, 405, '该 MCP 端点无状态，无需删除会话', 'METHOD_NOT_ALLOWED'));

module.exports = router;
