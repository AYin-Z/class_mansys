import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const envModule = require('../../config/env');
const jwt = require('jsonwebtoken');

const mockRes = () => ({ statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

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

  it('strict：Bearer 有效令牌放行', () => {
    envModule.env.UPLOAD_AUTH_MODE = 'strict';
    const mw = require('../../middleware/uploadAuth');
    const token = jwt.sign({ id: 1, role: 0 }, envModule.env.JWT_SECRET);
    const next = vi.fn();
    mw({ headers: { authorization: 'Bearer ' + token }, query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('strict：?token= 有效令牌放行', () => {
    envModule.env.UPLOAD_AUTH_MODE = 'strict';
    const mw = require('../../middleware/uploadAuth');
    const token = jwt.sign({ id: 1, role: 0 }, envModule.env.JWT_SECRET);
    const next = vi.fn();
    mw({ headers: {}, query: { token } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
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
