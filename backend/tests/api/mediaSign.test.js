import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';

// 必须在 require app 之前覆盖环境，避免连到生产库
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const db = require('../../config/database');
const { verifyMediaToken } = require('../../shared/mediaToken');

/** 取测试库里任意一个真实用户来签会话令牌（tv 必须与库里一致，否则会被 P2-2 拦下） */
let token = '';
const P1 = '/uploads/albums/1699999999_aaaaaa.jpg';
const P2 = '/uploads/albums/1699999999_bbbbbb.jpg';

beforeAll(async () => {
  const [rows] = await db.query('SELECT id, role, token_version FROM users ORDER BY id LIMIT 1');
  expect(rows.length).toBeGreaterThan(0);
  token = jwt.sign(
    { id: rows[0].id, role: rows[0].role, tv: Number(rows[0].token_version || 0) },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

const auth = (r) => r.set('Authorization', 'Bearer ' + token);

describe('POST /api/media/sign（P2-1 媒体短期签名）', () => {
  it('未登录 401', async () => {
    const res = await request(app).post('/api/media/sign').send({ paths: [P1] });
    expect(res.status).toBe(401);
  });

  it('paths 缺失/空/非数组 → 400', async () => {
    for (const body of [{}, { paths: [] }, { paths: 'x' }]) {
      const res = await auth(request(app).post('/api/media/sign')).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.code).toBe('BAD_PATHS');
    }
  });

  it('全部是非法路径时也返回 200（全部 skipped，前端回落旧方式）', async () => {
    const res = await auth(request(app).post('/api/media/sign')).send({ paths: [null, 42, ''] });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens).toEqual({});
    expect(res.body.data.skipped.length).toBe(3);
  });

  it('超过 100 个路径 → 400', async () => {
    const many = Array.from({ length: 101 }, (_, i) => '/uploads/albums/p' + i + '.jpg');
    const res = await auth(request(app).post('/api/media/sign')).send({ paths: many });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_MANY_PATHS');
  });

  it('签发成功：返回 tokens，越界/非法路径被跳过（skipped）', async () => {
    const res = await auth(request(app).post('/api/media/sign')).send({
      paths: [P1, P1, '/uploads/../etc/passwd', '/etc/passwd', '/uploads/', '  ']
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { tokens, ttlSec, skipped } = res.body.data;
    expect(Object.keys(tokens)).toEqual([P1]); // 重复路径只签一次
    expect(ttlSec).toBe(900);
    expect(skipped.length).toBe(4);
    // 令牌对"这条路径"有效，且带过期时间
    const v = verifyMediaToken(P1, tokens[P1]);
    expect(v.ok).toBe(true);
    expect(v.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(900);
  });

  it('可指定 ttlSec（被夹在 30s ~ 3600s）', async () => {
    const short = await auth(request(app).post('/api/media/sign')).send({ paths: [P1], ttlSec: 60 });
    expect(short.body.data.ttlSec).toBe(60);
    const tooLong = await auth(request(app).post('/api/media/sign')).send({ paths: [P1], ttlSec: 999999 });
    expect(tooLong.body.data.ttlSec).toBe(3600);
  });

  it('签发的 ?mt= 能通过 /uploads 鉴权；换路径/换签名则 403', async () => {
    const res = await auth(request(app).post('/api/media/sign')).send({ paths: [P1] });
    const mt = res.body.data.tokens[P1];

    // 文件不存在 → 404（说明已放行到 static，而不是被鉴权拦下）
    const okRes = await request(app).get(P1 + '?mt=' + encodeURIComponent(mt));
    expect(okRes.status).toBe(404);

    // 用 P1 的签名访问 P2 → 403
    const wrongPath = await request(app).get(P2 + '?mt=' + encodeURIComponent(mt));
    expect(wrongPath.status).toBe(403);
    expect(wrongPath.body.code).toBe('MEDIA_TOKEN_INVALID');

    // 乱造的签名 → 403
    const bad = await request(app).get(P1 + '?mt=1700000000.notasignatureatall');
    expect(bad.status).toBe(403);
  });

  it('过渡期兼容：旧的 ?token=<会话JWT> 仍可访问 /uploads', async () => {
    const res = await request(app).get(P1 + '?token=' + encodeURIComponent(token));
    expect(res.status).toBe(404); // 放行到 static（文件不存在）
  });
});
