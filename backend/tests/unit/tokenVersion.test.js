import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// CI 环境没有 backend/.env，必须显式给出 JWT_SECRET
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_1234567';

const require = createRequire(import.meta.url);
const { createTokenVersionGuard, normalizeTv } = require('../../shared/tokenVersion');
const { signToken } = require('../../services/authService');
const jwt = require('jsonwebtoken');

/**
 * 测试用守卫：注入内存版本表 + 可控时钟，不碰数据库。
 * check() 的语义与生产实例完全一致（同一份 createTokenVersionGuard 代码）。
 */
function makeHarness(initial = {}, options = {}) {
  const versions = new Map(Object.entries(initial).map(([k, v]) => [Number(k), v]));
  let reads = 0;
  let bumps = 0;
  let failReads = false;
  let nowMs = 1_700_000_000_000;

  const guard = createTokenVersionGuard({
    ttlMs: options.ttlMs || 60_000,
    errorBackoffMs: options.errorBackoffMs || 10_000,
    now: () => nowMs,
    log: { warn() {} },
    readVersion: async (id) => {
      reads += 1;
      if (failReads) throw new Error('db is down');
      return versions.has(id) ? versions.get(id) : null;
    },
    bumpVersion: async (id) => {
      bumps += 1;
      if (!versions.has(id)) return null;
      versions.set(id, versions.get(id) + 1);
      return versions.get(id);
    }
  });

  return {
    guard,
    versions,
    advance: (ms) => {
      nowMs += ms;
    },
    reads: () => reads,
    bumps: () => bumps,
    setFailReads: (v) => {
      failReads = v;
    }
  };
}

describe('token_version 会话吊销（P2-2）', () => {
  it('无 tv 的旧令牌按 tv=0 处理：库里还是 0 → 放行', async () => {
    const h = makeHarness({ 7: 0 });
    const r = await h.guard.check({ id: 7, role: 0 });
    expect(r).toMatchObject({ ok: true, reason: 'ok', tv: 0 });
  });

  it('tv 不匹配 → 拒绝（改密/重置/移出之后）', async () => {
    const h = makeHarness({ 7: 3 });
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: false, reason: 'tv-mismatch', expected: 3, got: 0 });
    expect(await h.guard.check({ id: 7, tv: 3 })).toMatchObject({ ok: true, reason: 'ok' });
  });

  it('用户不存在 → 拒绝（user-missing）', async () => {
    const h = makeHarness();
    expect(await h.guard.check({ id: 99, tv: 0 })).toMatchObject({ ok: false, reason: 'user-missing' });
  });

  it('令牌里没有 id → 拒绝（no-user）', async () => {
    const h = makeHarness({ 7: 0 });
    expect(await h.guard.check({ role: 0 })).toMatchObject({ ok: false, reason: 'no-user' });
    expect(await h.guard.check(null)).toMatchObject({ ok: false, reason: 'no-user' });
    expect(await h.guard.check({ id: 0 })).toMatchObject({ ok: false, reason: 'no-user' });
  });

  it('缓存命中：TTL 内同一用户只打库一次，过期后重新读取', async () => {
    const h = makeHarness({ 7: 0 });
    await h.guard.check({ id: 7, tv: 0 });
    await h.guard.check({ id: 7, tv: 0 });
    await h.guard.check({ id: 7, tv: 0 });
    expect(h.reads()).toBe(1);

    h.advance(59_000);
    await h.guard.check({ id: 7, tv: 0 });
    expect(h.reads()).toBe(1);

    h.advance(2_000); // 超过 60s TTL
    await h.guard.check({ id: 7, tv: 0 });
    expect(h.reads()).toBe(2);
  });

  it('缓存命中时若库里已变更，最多在 TTL 窗口内仍放行（已知窗口）', async () => {
    const h = makeHarness({ 7: 0 });
    await h.guard.check({ id: 7, tv: 0 });
    h.versions.set(7, 1); // 模拟另一个进程改了库、但本进程缓存还没过期
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: true });
    h.advance(60_001);
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: false, reason: 'tv-mismatch' });
  });

  it('invalidate 立即清缓存：下一次请求就按新值判定', async () => {
    const h = makeHarness({ 7: 0 });
    await h.guard.check({ id: 7, tv: 0 });
    expect(h.reads()).toBe(1);
    h.versions.set(7, 1);
    h.guard.invalidate(7);
    await h.guard.check({ id: 7, tv: 0 });
    expect(h.reads()).toBe(2);
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: false, reason: 'tv-mismatch' });
  });

  it('bump：tv+1、清缓存，旧 tv 立刻失效、新 tv 放行', async () => {
    const h = makeHarness({ 7: 4 });
    await h.guard.check({ id: 7, tv: 4 }); // 先填充缓存
    const next = await h.guard.bump(7);
    expect(next).toBe(5);
    expect(h.bumps()).toBe(1);
    expect(await h.guard.check({ id: 7, tv: 4 })).toMatchObject({ ok: false, reason: 'tv-mismatch', expected: 5 });
    expect(await h.guard.check({ id: 7, tv: 5 })).toMatchObject({ ok: true });
  });

  it('bump 一个不存在的用户 → null（且不抛异常）', async () => {
    const h = makeHarness();
    expect(await h.guard.bump(123)).toBeNull();
    expect(await h.guard.bump(0)).toBeNull();
    expect(await h.guard.bump(undefined)).toBeNull();
  });

  it('读取失败：降级放行 + 告警，退避窗口内不再打库', async () => {
    const h = makeHarness({ 7: 0 });
    h.setFailReads(true);
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: true, reason: 'db-error', degraded: true });
    expect(h.reads()).toBe(1);
    // 退避期内不再打库（避免每个请求都撞数据库）
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: true, reason: 'db-error' });
    expect(h.reads()).toBe(1);
    // 退避结束后恢复查询，并按真实 tv 判定
    h.setFailReads(false);
    h.advance(10_001);
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: true, reason: 'ok' });
    expect(h.reads()).toBe(2);
  });

  it('多用户各自独立缓存', async () => {
    const h = makeHarness({ 7: 0, 8: 2 });
    expect(await h.guard.check({ id: 7, tv: 0 })).toMatchObject({ ok: true });
    expect(await h.guard.check({ id: 8, tv: 2 })).toMatchObject({ ok: true });
    expect(await h.guard.check({ id: 8, tv: 0 })).toMatchObject({ ok: false, reason: 'tv-mismatch' });
    expect(h.reads()).toBe(2);
  });

  it('normalizeTv：缺失/非法/负数 → 0', () => {
    expect(normalizeTv(undefined)).toBe(0);
    expect(normalizeTv(null)).toBe(0);
    expect(normalizeTv('2')).toBe(2);
    expect(normalizeTv(-1)).toBe(0);
    expect(normalizeTv('abc')).toBe(0);
  });

  it('签发的 JWT 带 tv；用户对象没有该字段时按 0（与迁移前语义一致）', () => {
    const withTv = jwt.decode(signToken({ id: 3, openid: 'o', role: 1, class_id: 'A', token_version: 5 }));
    expect(withTv.tv).toBe(5);
    const legacyUser = jwt.decode(signToken({ id: 3, openid: 'o', role: 1, class_id: 'A' }));
    expect(legacyUser.tv).toBe(0);
    expect(legacyUser.id).toBe(3);
    expect(legacyUser.role).toBe(1);
  });
});
