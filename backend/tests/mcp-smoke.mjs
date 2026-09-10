#!/usr/bin/env node
/**
 * MCP 冒烟验证：用真实令牌启动 MCP Server（stdio），列出工具并调用一个只读工具。
 * 用法：
 *   TOKEN=$(cd backend && node -e "require('./services/apiToken').ApiTokenService.create(1,'mcp-smoke').then(r=>console.log(r.token))")
 *   CM_TOKEN=$TOKEN node backend/tests/mcp-smoke.mjs
 * 注意：会以该用户身份真实调用内部 API（只读），请使用测试账号或不介意被记录的用户。
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, '..', 'mcp', 'server.js');
const token = process.env.CM_TOKEN || process.argv[2] || '';
if (!token) {
  console.error('缺少令牌：CM_TOKEN=cm_xxx node tests/mcp-smoke.mjs');
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [SERVER],
  env: Object.assign({}, process.env, {
    CM_API_TOKEN: token,
    CM_BASE_URL: process.env.CM_BASE_URL || 'http://127.0.0.1:3002',
    CM_ALLOW_WRITE: process.env.CM_ALLOW_WRITE || ''
  }),
  stderr: 'pipe'
});

const client = new Client({ name: 'mcp-smoke', version: '1.0.0' });
await client.connect(transport);

const list = await client.listTools();
const names = list.tools.map((t) => t.name);
console.log('工具数 =', names.length, '| 含写工具 =', names.includes('cm_apply_leave'));

for (const name of ['cm_my_leaves', 'cm_system_guide']) {
  const args = name === 'cm_system_guide' ? { query: '怎么请假' } : {};
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content || []).map((c) => c.text || '').join('');
  console.log(name, '| isError =', !!res.isError, '|', text.slice(0, 140).replace(/\s+/g, ' '));
}

await client.close();
process.exit(0);
