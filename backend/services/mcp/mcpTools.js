const { z } = require('zod');
const { toOpenAiTools } = require('../agent/toolCatalog');

/**
 * 把系统工具目录映射成 MCP 工具定义（纯函数，便于测试）
 * @param {object} catalog buildTools(app) 的结果
 * @param {{allowWrite?: boolean}} opts allowWrite=false 时：跳过写类快捷工具，模块工具仅保留 GET action
 */
function buildMcpTools(catalog, opts = {}) {
  const allowWrite = !!opts.allowWrite;
  const out = [];

  for (const tool of catalog.tools) {
    if (tool.kind === 'module') {
      const actions = allowWrite ? tool.actions : tool.actions.filter((a) => a.startsWith('GET '));
      if (!actions.length) continue;
      out.push({
        name: 'cm_' + tool.name,
        description: '[模块] ' + tool.description + (allowWrite ? '' : '（只读模式：仅 GET）'),
        shape: {
          action: z.enum(actions),
          params: z.record(z.string(), z.any()).optional().describe('写操作请求体'),
          query: z.record(z.string(), z.any()).optional().describe('GET 查询参数')
        },
        tool
      });
      continue;
    }

    if (tool.kind === 'local') {
      const shape = {};
      for (const p of tool.params || []) shape[p] = z.string().optional();
      out.push({ name: 'cm_' + tool.name, description: '[引导] ' + (tool.desc || ''), shape, tool });
      continue;
    }

    // curated
    if (tool.write && !allowWrite) continue;
    const shape = {};
    for (const k of tool.pathParams || []) shape[k] = z.union([z.string(), z.number()]);
    for (const k of tool.body || []) shape[k] = z.any().optional();
    for (const k of tool.query || []) shape[k] = z.any().optional();
    out.push({
      name: 'cm_' + tool.name,
      description: (tool.write ? '[写操作] ' : '[只读] ') + (tool.label || '') + ' ' + (tool.desc || ''),
      shape,
      tool
    });
  }

  return out;
}

module.exports = { buildMcpTools };
