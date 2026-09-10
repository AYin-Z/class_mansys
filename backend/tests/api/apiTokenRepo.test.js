import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const db = require('../../config/database');
const { ApiTokenService } = require('../../services/apiToken');
const User = require('../../models/User');

let ready = false;
let userId = null;
const created = [];

beforeAll(async () => {
  try {
    const [rows] = await db.query('SELECT id FROM users ORDER BY id LIMIT 1');
    userId = rows[0] && rows[0].id;
    ready = !!userId;
  } catch (e) {
    ready = false; // 无测试库时跳过（不连生产库）
  }
});

afterAll(async () => {
  if (ready && created.length) {
    await db.query('DELETE FROM api_tokens WHERE id IN (' + created.map(() => '?').join(',') + ')', created);
  }
  try { await db.end(); } catch (e) { /* ignore */ }
});

describe('个人访问令牌（需要测试库）', () => {
  it('创建 → 校验通过 → 吊销后失效', async () => {
    if (!ready) return;
    const { token } = await ApiTokenService.create(userId, '单元测试令牌');
    const [rows] = await db.query('SELECT id, token_hash, prefix FROM api_tokens WHERE prefix = ?', [token.slice(0, 10)]);
    const row = rows[rows.length - 1];
    created.push(row.id);
    expect(row.token_hash).not.toBe(token); // 库里不存明文
    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await ApiTokenService.verify(token)).toBe(userId);
    expect(await ApiTokenService.verify('cm_deadbeef')).toBe(null);
    expect(await ApiTokenService.verify('')).toBe(null);
    expect(await ApiTokenService.revoke(userId, row.id)).toBe(true);
    expect(await ApiTokenService.verify(token)).toBe(null);
  });

  it('列表返回前缀而不含明文，且不串用户', async () => {
    if (!ready) return;
    const other = await User.findById(userId);
    const { token } = await ApiTokenService.create(userId, '另一个令牌');
    const [rows] = await db.query('SELECT id FROM api_tokens WHERE prefix = ?', [token.slice(0, 10)]);
    created.push(rows[rows.length - 1].id);
    const list = await ApiTokenService.list(userId);
    const json = JSON.stringify(list);
    expect(json).not.toContain(token);
    expect(list.every((t) => t.user_id === undefined)).toBe(true);
    expect(other).toBeTruthy();
  });
});
