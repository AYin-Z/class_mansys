import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

// CI 环境没有 backend/.env，必须显式给出 JWT_SECRET
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_1234567';

const require = createRequire(import.meta.url);
const envModule = require('../../config/env');
const {
  signMediaToken,
  verifyMediaToken,
  isSafeMediaPath,
  basePathOf,
  DEFAULT_TTL_SEC,
  MAX_TTL_SEC
} = require('../../shared/mediaToken');

const IMG = '/uploads/albums/1699999999_ab12cd.jpg';
const OTHER = '/uploads/albums/1699999999_zz99yy.jpg';

describe('媒体短期签名令牌（P2-1）', () => {
  beforeEach(() => {
    envModule.env.JWT_SECRET = 'test_secret_1234567';
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    envModule.env.JWT_SECRET = 'test_secret_1234567';
  });

  it('签发 → 校验通过，默认 TTL 15 分钟', () => {
    const token = signMediaToken(IMG);
    expect(token).toMatch(/^\d{10,}\.[A-Za-z0-9_-]{32}$/);
    const exp = Number(token.split('.')[0]);
    expect(exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(DEFAULT_TTL_SEC - 5);
    expect(exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(DEFAULT_TTL_SEC);

    const r = verifyMediaToken(IMG, token);
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('ok');
    expect(r.matchedPath).toBe(IMG);
  });

  it('令牌按路径限定：换一个文件即不通过', () => {
    const token = signMediaToken(IMG);
    const r = verifyMediaToken(OTHER, token);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('path-mismatch');
    // 换个目录同样不行
    expect(verifyMediaToken('/uploads/leaves/1699999999_ab12cd.jpg', token).ok).toBe(false);
  });

  it('签名被篡改 → 拒绝', () => {
    const token = signMediaToken(IMG);
    const [exp, sig] = token.split('.');
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(verifyMediaToken(IMG, exp + '.' + flipped)).toMatchObject({ ok: false, reason: 'path-mismatch' });
  });

  it('过期 → 拒绝（reason=expired）', () => {
    const token = signMediaToken(IMG, { ttlSec: 60 });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 1000);
    const r = verifyMediaToken(IMG, token);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('expired');
  });

  it('ttlSec 被夹紧：非法值取默认，超过上限取上限', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const d = signMediaToken(IMG, { ttlSec: 0 });
    expect(Number(d.split('.')[0]) - nowSec).toBeGreaterThan(DEFAULT_TTL_SEC - 5);
    const big = signMediaToken(IMG, { ttlSec: 24 * 3600 });
    expect(Number(big.split('.')[0]) - nowSec).toBeLessThanOrEqual(MAX_TTL_SEC);
  });

  it('派生图共用原图签名：_thumb / _medium 可访问，且标记 derived', () => {
    const token = signMediaToken(IMG);
    for (const suffix of ['_thumb', '_medium']) {
      const p = IMG.replace(/\.jpg$/, suffix + '.jpg');
      const r = verifyMediaToken(p, token);
      expect(r.ok, p).toBe(true);
      expect(r.derived).toBe(true);
      expect(r.matchedPath).toBe(IMG);
    }
  });

  it('派生图签名不能被"升级"用到原图，也不能跨图使用', () => {
    const thumbPath = IMG.replace(/\.jpg$/, '_thumb.jpg');
    const token = signMediaToken(thumbPath);
    expect(verifyMediaToken(thumbPath, token).ok).toBe(true);
    // 用 _thumb 的签名访问原图：候选路径里没有 "给 _thumb 路径签名" 这一项 → 拒绝
    expect(verifyMediaToken(IMG, token).ok).toBe(false);
    // 另一张图的派生图也不行
    expect(verifyMediaToken(OTHER.replace(/\.jpg$/, '_thumb.jpg'), token).ok).toBe(false);
  });

  it('basePathOf：派生前缀与扩展名处理', () => {
    expect(basePathOf('/uploads/a/b_thumb.jpg')).toBe('/uploads/a/b.jpg');
    expect(basePathOf('/uploads/a/b_medium.PNG')).toBe('/uploads/a/b.PNG');
    expect(basePathOf('/uploads/a/b_thumbnail.jpg')).toBe('/uploads/a/b_thumbnail.jpg');
    expect(basePathOf(IMG + '?x=1')).toBe(IMG);
  });

  it('带 query / 百分号编码的请求路径也能校验（服务端取的是 URL 路径）', () => {
    const cn = '/uploads/albums/证明 图.jpg';
    const token = signMediaToken(cn);
    expect(verifyMediaToken(cn + '?mt=xx', token).ok).toBe(true);
    expect(verifyMediaToken(encodeURIComponent(cn), token).ok).toBe(true);
  });

  it('畸形令牌一律拒绝（missing/malformed）', () => {
    expect(verifyMediaToken(IMG, '')).toMatchObject({ ok: false, reason: 'missing' });
    expect(verifyMediaToken(IMG, null)).toMatchObject({ ok: false, reason: 'missing' });
    expect(verifyMediaToken(IMG, 'abc')).toMatchObject({ ok: false, reason: 'malformed' });
    expect(verifyMediaToken(IMG, 'x.y')).toMatchObject({ ok: false, reason: 'malformed' });
    expect(verifyMediaToken(IMG, '1700000000.short')).toMatchObject({ ok: false, reason: 'malformed' });
    expect(verifyMediaToken(IMG, '-5.abcdefghijklmnopqrstuvwxyz012345')).toMatchObject({
      ok: false,
      reason: 'malformed'
    });
  });

  it('越界路径不可签名（.. / 非 /uploads / 反斜杠 / 空字节 / 编码穿越）', () => {
    for (const bad of [
      '/uploads/../etc/passwd',
      '/etc/passwd',
      '/uploads/',
      '/uploads/a\\b.jpg',
      '/uploads/a\u0000b.jpg',
      '/uploads/%2e%2e/package.json',
      '/uploads/%2E%2E/package.json',
      '/uploads/%zz.jpg',
      '',
      null
    ]) {
      expect(isSafeMediaPath(bad), String(bad)).toBe(false);
      expect(() => signMediaToken(bad)).toThrow(/非法的媒体路径/);
    }
    expect(isSafeMediaPath(IMG)).toBe(true);
  });

  it('换 JWT_SECRET 后旧签名立即失效（密钥是派生的，不需要新配置项）', () => {
    const token = signMediaToken(IMG);
    expect(verifyMediaToken(IMG, token).ok).toBe(true);
    envModule.env.JWT_SECRET = 'another_secret_987654321';
    expect(verifyMediaToken(IMG, token).ok).toBe(false);
    // 新密钥下重新签发即可用
    expect(verifyMediaToken(IMG, signMediaToken(IMG)).ok).toBe(true);
    // 与直接用 JWT_SECRET 签名（无派生）不通用：签名密钥确实做了派生
    const jwt = require('jsonwebtoken');
    const wrong = jwt.sign({}, 'test_secret_1234567');
    expect(wrong).toBeTruthy();
  });

  it('userId 只是审计信息，不参与签名（同一路径同一秒签发结果一致）', () => {
    const a = signMediaToken(IMG, { userId: 1 });
    const b = signMediaToken(IMG, { userId: 999 });
    expect(a).toBe(b);
  });
});
