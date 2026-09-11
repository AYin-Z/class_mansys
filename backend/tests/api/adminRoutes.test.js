import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('../../app');

describe('超管后台接口（认证与权限外壳）', () => {
  const paths = [
    ['get', '/api/admin/console/overview'],
    ['get', '/api/admin/console/todos'],
    ['get', '/api/admin/console/agent'],
    ['get', '/api/admin/system/status'],
    ['get', '/api/admin/audit'],
    ['get', '/api/admin/classes'],
    ['get', '/api/admin/permissions'],
    ['get', '/api/admin/export/roster.csv'],
    ['get', '/api/admin/export/roster.xlsx']
  ];

  it('未登录一律 401', async () => {
    for (const [method, path] of paths) {
      const res = await request(app)[method](path);
      expect(res.status, path).toBe(401);
    }
  });

  it('无效令牌一律拒绝（401/403）', async () => {
    const res = await request(app).get('/api/admin/console/overview').set('Authorization', 'Bearer not-a-token');
    expect([401, 403]).toContain(res.status);
  });

  it('写接口需要认证（未登录 401）', async () => {
    const create = await request(app).post('/api/admin/members').send({ name: '张三', student_id: '202521719999' });
    expect(create.status).toBe(401);
    const perm = await request(app).put('/api/admin/permissions/VIEW_ROSTER').send({ roles: [1, 8] });
    expect(perm.status).toBe(401);
    const roster = await request(app).post('/api/admin/roster/preview');
    expect(roster.status).toBe(401);
  });

  it('导入接口拒绝非 xlsx（无文件时 400/401 而非 500）', async () => {
    const res = await request(app).post('/api/admin/roster/preview');
    expect([400, 401]).toContain(res.status);
  });
});
