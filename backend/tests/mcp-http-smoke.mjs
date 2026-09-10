#!/usr/bin/env node
/**
 * MCP over HTTP 冒烟：用真实令牌走 Streamable HTTP，验证 initialize / tools/list / tools/call。
 * 用法：
 *   CM_TOKEN=cm_xxx [CM_BASE_URL=https://cls.ayinserver.xin] node tests/mcp-http-smoke.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const token = process.env.CM_TOKEN || process.argv[2] || '';
const base = process.env.CM_BASE_URL || 'http://127.0.0.1:3002';
if (!token) {
  console.error('缺少令牌：CM_TOKEN=cm_xxx node tests/mcp-http-smoke.mjs');
  process.exit(1);
}

const url = new URL('/api/mcp', base);
const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: 'Bearer ' + token } } });
const client = new Client({ name: 'mcp-http-smoke', version: '1.0.0' });
await client.connect(transport);

const list = await client.listTools();
const names = list.tools.map((t) => t.name);
console.log('HTTP MCP 工具数 =', names.length, '| 含写工具 =', names.includes('cm_apply_leave'));

const res = await client.callTool({ name: 'cm_my_leaves', arguments: {} });
const text = (res.content || []).map((c) => c.text || '').join('');
console.log('cm_my_leaves ok =', !res.isError, '|', text.slice(0, 120).replace(/\s+/g, ' '));

await client.close();
process.exit(0);
