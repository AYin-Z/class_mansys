import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('../../app');

const ACCEPT = 'application/json, text/event-stream';

describe('MCP over HTTP 路由（认证与协议外壳）', () => {
  it('未带令牌时 /api/mcp/info 返回 401', async () => {
    const res = await request(app).get('/api/mcp/info');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('无效令牌返回 401（不泄露是否存在）', async () => {
    const res = await request(app).get('/api/mcp/info').set('Authorization', 'Bearer cm_not_a_real_token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/令牌无效或已吊销/);
  });

  it('支持 x-api-key 头但同样需要有效令牌', async () => {
    const res = await request(app).get('/api/mcp/info').set('x-api-key', 'cm_nope');
    expect(res.status).toBe(401);
  });

  it('POST 无令牌返回 401，不支持的 GET/DELETE 返回 405', async () => {
    const post = await request(app).post('/api/mcp').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(post.status).toBe(401);
    const del = await request(app).delete('/api/mcp').set('Accept', ACCEPT);
    expect(del.status).toBe(405);
    const get = await request(app).get('/api/mcp').set('Accept', ACCEPT);
    expect(get.status).toBe(405);
  });

  it('MCP 端点不会出现在自身工具目录里', async () => {
    const { buildTools } = require('../../services/agent/toolCatalog');
    const catalog = buildTools(app);
    expect(catalog.tools.some((t) => t.name.indexOf('mcp') > -1)).toBe(false);
    expect(catalog.tools.length).toBeGreaterThan(30);
  });
});
