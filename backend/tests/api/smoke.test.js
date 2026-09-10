import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// 必须在 require app 之前覆盖环境，避免连到生产库
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('../../app');

describe('API 冒烟（不依赖数据库）', () => {
  it('GET /health 返回 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('未知 API 返回统一 404 结构', async () => {
    const res = await request(app).get('/api/definitely-not-exists');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('未认证访问受保护接口返回 401', async () => {
    const res = await request(app).get('/api/company/overview');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('请求带 x-request-id 响应头', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('CORS：白名单来源放行，未知来源不返回 ACAO', async () => {
    const okRes = await request(app).get('/health').set('Origin', 'https://cls.ayinserver.xin');
    expect(okRes.headers['access-control-allow-origin']).toBe('https://cls.ayinserver.xin');
    const badRes = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(badRes.headers['access-control-allow-origin']).toBeUndefined();
  });
});
