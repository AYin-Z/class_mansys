import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const http = require('../../shared/http');
const { ok, fail, asyncHandler, errorHandler, HttpError, ForbiddenError, NotFoundError } = http;

function mockRes() {
  return {
    statusCode: 200,
    headersSent: false,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}
const quietReq = () => ({ log: { error() {}, warn() {} }, originalUrl: '/test' });

describe('统一响应助手', () => {
  it('ok 返回 success + data', () => {
    const res = mockRes();
    ok(res, { id: 1 });
    expect(res.body).toEqual({ success: true, data: { id: 1 } });
  });

  it('ok 支持附加顶层字段（兼容旧前端）', () => {
    const res = mockRes();
    ok(res, [1, 2], { items: [1, 2], total: 2 });
    expect(res.body).toEqual({ success: true, total: 2, data: [1, 2], items: [1, 2] });
  });

  it('fail 带状态码与错误码', () => {
    const res = mockRes();
    fail(res, 403, '权限不足', 'FORBIDDEN');
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: '权限不足', code: 'FORBIDDEN' });
  });
});

describe('asyncHandler', () => {
  it('正常路径不调用 next', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async (req, res) => { res.json({ ok: true }); });
    const res = mockRes();
    await handler({}, res, next);
    expect(res.body).toEqual({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('异常交给 next', async () => {
    const err = new Error('boom');
    const next = vi.fn();
    const handler = asyncHandler(async () => { throw err; });
    await handler({}, mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('errorHandler', () => {
  it('HttpError 映射到对应状态码与 code', () => {
    const res = mockRes();
    errorHandler(new ForbiddenError('无权访问'), quietReq(), res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: '无权访问', code: 'FORBIDDEN' });
  });

  it('未预期异常返回 500 且不泄露内部信息', () => {
    const res = mockRes();
    errorHandler(new Error('db exploded'), quietReq(), res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: '服务器内部错误', code: 'INTERNAL_ERROR' });
  });

  it('文件类型错误映射为 400', () => {
    const res = mockRes();
    errorHandler(new Error('不支持的文件类型'), quietReq(), res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('NotFoundError 为 404', () => {
    const res = mockRes();
    errorHandler(new NotFoundError('不存在'), quietReq(), res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('HttpError 基类状态码可自定义', () => {
    const e = new HttpError(422, '参数不合法', 'UNPROCESSABLE');
    const res = mockRes();
    errorHandler(e, quietReq(), res, () => {});
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('参数不合法');
  });
});
