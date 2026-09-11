import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// CI 环境没有 backend/.env，必须显式给出 JWT_SECRET，
// 否则 config/env 校验/签名会抛 'secretOrPrivateKey must have a value'
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_1234567';

const require = createRequire(import.meta.url);

const envModule = require('../../config/env');
const jwt = require('jsonwebtoken');

const mockRes = () => ({
  statusCode: 200,
  body: undefined,
  headers: {},
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
  set(k, v) { this.headers[k] = v; return this; }
});

describe('requireUploadAccess', () => {
  beforeEach(() => { vi.resetModules(); });

  it('strict：无令牌 401', () => {
    envModule.env.UPLOAD_AUTH_MODE = 'strict';
    const mw = require('../../middleware/uploadAuth');
    const res = mockRes();
    const next = vi.fn();
    mw({ headers: {}, query: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('strict：Bearer 有效令牌放行，并设置私有缓存', () => {
    envModule.env.UPLOAD_AUTH_MODE = 'strict';
    const mw = require('../../middleware/uploadAuth');
    const token = jwt.sign({ id: 1, role: 0 }, envModule.env.JWT_SECRET);
    const res = mockRes();
    const next = vi.fn();
    mw({ headers: { authorization: 'Bearer ' + token }, query: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('private, max-age=300');
  });

  it('strict：?token= 有效令牌放行，并设置私有缓存', () => {
    envModule.env.UPLOAD_AUTH_MODE = 'strict';
    const mw = require('../../middleware/uploadAuth');
    const token = jwt.sign({ id: 1, role: 0 }, envModule.env.JWT_SECRET);
    const res = mockRes();
    const next = vi.fn();
    mw({ headers: {}, query: { token } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('private, max-age=300');
  });

  it('strict：无效令牌 403', () => {
    envModule.env.UPLOAD_AUTH_MODE = 'strict';
    const mw = require('../../middleware/uploadAuth');
    const res = mockRes();
    mw({ headers: { authorization: 'Bearer bad' }, query: {} }, res, vi.fn());
    expect(res.statusCode).toBe(403);
  });

  it('compat：无令牌也放行（灰度兼容）', () => {
    envModule.env.UPLOAD_AUTH_MODE = 'compat';
    const mw = require('../../middleware/uploadAuth');
    const next = vi.fn();
    mw({ headers: {}, query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
    envModule.env.UPLOAD_AUTH_MODE = 'strict';
  });
});

describe('访问日志令牌脱敏（pino redact）', () => {
  it('req.url 里的 ?token= 与 Authorization 头都不落日志', async () => {
    const express = require('express');
    const pinoHttp = require('pino-http');
    const request = require('supertest');
    const { Writable } = require('node:stream');
    const { createLogger } = require('../../config/logger');

    const lines = [];
    const sink = new Writable({
      write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); }
    });
    const testLogger = createLogger(sink, 'info');

    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    app.get('/uploads/demo.jpg', (req, res) => res.json({ ok: true }));

    await request(app)
      .get('/uploads/demo.jpg?token=SUPER_SECRET_JWT&page=2')
      .set('Authorization', 'Bearer HEADER_SECRET_JWT');

    const joined = lines.join('\n');
    expect(joined).toContain('/uploads/demo.jpg'); // 路径仍可排查
    expect(joined).toContain('page=2'); // 非敏感参数保留
    expect(joined).toContain('token=***'); // URL 里的令牌被局部脱敏
    expect(joined).toContain('"token":"***"'); // 序列化后的 req.query 同样脱敏
    expect(joined).not.toContain('SUPER_SECRET_JWT');
    expect(joined).not.toContain('HEADER_SECRET_JWT');
  });

  it('express.static 的 301 重定向（Location 带令牌）也不落日志', async () => {
    const express = require('express');
    const pinoHttp = require('pino-http');
    const request = require('supertest');
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const { Writable } = require('node:stream');
    const { createLogger } = require('../../config/logger');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-log-'));
    const lines = [];
    const sink = new Writable({
      write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); }
    });

    const app = express();
    app.use(pinoHttp({ logger: createLogger(sink, 'info') }));
    app.use('/uploads', express.static(dir));

    try {
      // /uploads 会 301 到 /uploads/ 并保留 ?token=，令牌会出现在响应 Location 头里
      await request(app).get('/uploads?token=REDIRECT_SECRET_JWT');
      const joined = lines.join('\n');
      expect(joined).toContain('/uploads/?token=***');
      expect(joined).not.toContain('REDIRECT_SECRET_JWT');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('requireUploadAccess + express.static 集成', () => {
  it('无令牌 401；带 ?token= 200 且 Cache-Control 为私有缓存', async () => {
    const express = require('express');
    const request = require('supertest');
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-auth-'));
    fs.writeFileSync(path.join(dir, 'proof.txt'), 'private-proof');
    try {
      envModule.env.UPLOAD_AUTH_MODE = 'strict';
      const mw = require('../../middleware/uploadAuth');
      const app = express();
      app.use('/uploads', mw, express.static(dir));

      const deny = await request(app).get('/uploads/proof.txt');
      expect(deny.status).toBe(401);

      const token = jwt.sign({ id: 1, role: 0 }, envModule.env.JWT_SECRET);
      const ok = await request(app).get('/uploads/proof.txt?token=' + encodeURIComponent(token));
      expect(ok.status).toBe(200);
      expect(ok.text).toBe('private-proof');
      // express.static 只在未设置时补 Cache-Control，这里的 private 必须保住
      expect(ok.headers['cache-control']).toBe('private, max-age=300');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
