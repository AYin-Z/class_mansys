const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { buildTools } = require('../agent/toolCatalog');
const { buildMcpTools } = require('../mcp/mcpTools');
const { execute } = require('../agent/toolRunner');

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

  return { server, tools };
}

module.exports = { buildMcpServer, catalogFor };
