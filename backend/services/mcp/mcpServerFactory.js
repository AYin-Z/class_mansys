const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { buildTools } = require('../agent/toolCatalog');
const { buildMcpTools } = require('../mcp/mcpTools');
const { execute } = require('../agent/toolRunner');
const { isWriteCall } = require('../agent/toolCatalog');
const AgentRepo = require('../agent/repo');
const AgentService = require('../agent/agentService');
const { env } = require('../../config/env');
const { preview } = require('../agent/toolRunner');

/**
 * 组装 MCP Server（stdio 与 HTTP 共用）
 *
 * 安全模型：
 * - allowWrite 来自**令牌作用域**（数据库），环境变量只能再收紧、不能放宽；
 * - 每个工具调用都以该用户身份走内部 API（内部 JWT），因此权限矩阵、区队/中队作用域、
 *   写操作二次确认、审计全部照旧生效——MCP 不提供任何绕过通道。
 */
const catalogCache = new WeakMap();

function catalogFor(app) {
  if (!catalogCache.has(app)) catalogCache.set(app, buildTools(app));
  return catalogCache.get(app);
}

/**
 * @param {object} opts
 * @param {object} opts.app      Express app（仅用于读取路由表生成工具目录）
 * @param {object} opts.user     令牌对应的用户
 * @param {string} opts.jwt      以该用户身份签发的内部 JWT
 * @param {boolean} opts.allowWrite 是否暴露写工具
 */
function buildMcpServer({ app, user, jwt, allowWrite }) {
  const catalog = catalogFor(app);
  const tools = buildMcpTools(catalog, { allowWrite: !!allowWrite });
  const server = new McpServer({ name: 'class-mansys', version: '1.1.0' });

  for (const t of tools) {
    server.registerTool(
      t.name,
      { title: t.name, description: t.description, inputSchema: t.shape },
      async (args) => {
        try {
          // 写操作不直接落库：先生成待确认动作，由用户在自己的客户端里确认后执行
          if (isWriteCall(t.tool, args)) {
            const actionId = await AgentRepo.createAction({
              conversationId: null,
              userId: user.id,
              tool: t.tool.name,
              method: t.tool.method || (String((args || {}).action || '').split(' ')[0] || 'POST'),
              path: t.tool.path || String((args || {}).action || '').split(' ').slice(1).join(' '),
              params: args || {},
              preview: preview(t.tool, args || {}),
              ttlMs: env.AGENT_ACTION_TTL_MS
            });
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'pending_confirmation',
                  actionId,
                  preview: preview(t.tool, args || {}),
                  hint: '这是写操作，尚未落库。请把 actionId 交给用户确认后，调用 cm_agent_confirm 才会真正执行（' + Math.round(env.AGENT_ACTION_TTL_MS / 1000) + ' 秒内有效）。'
                })
              }]
            };
          }
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

  // 写操作的第二步：确认执行（与站内、微信一致的两阶段确认）
  // 只在暴露写工具时注册，避免只读模式下工具数与文档口径不一致
  if (allowWrite) server.registerTool(
    'cm_agent_confirm',
    {
      title: 'cm_agent_confirm',
      description: '确认执行一个待确认动作（写操作第二步）。参数 actionId 来自写工具返回的 pending_confirmation。',
      inputSchema: { actionId: require('zod').z.union([require('zod').z.string(), require('zod').z.number()]) }
    },
    async (args) => {
      try {
        const result = await AgentService.confirm({ id: user.id, name: user.name, role: user.role }, jwt, Number((args || {}).actionId), app);
        return { content: [{ type: 'text', text: JSON.stringify(result).slice(0, 12000) }] };
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: '确认失败：' + e.message }] };
      }
    }
  );

  return { server, tools };
}

module.exports = { buildMcpServer, catalogFor };