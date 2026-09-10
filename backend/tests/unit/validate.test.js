import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { validateBody } = require('../../shared/validate');
const { schemas } = require('../../shared/schemas');
const { BadRequestError } = require('../../shared/http');

describe('validateBody 中间件', () => {
  it('校验通过后用解析结果替换 req.body 并调用 next', () => {
    const req = { body: { student_id: 'S1', password: 'x' } };
    const next = vi.fn();
    validateBody(schemas.loginWithPassword)(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body.student_id).toBe('S1');
  });

  it('缺字段时交给 errorHandler（BadRequestError + VALIDATION_ERROR）', () => {
    const req = { body: { password: 'x' } };
    const next = vi.fn();
    validateBody(schemas.loginWithPassword)(req, {}, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toContain('student_id');
  });

  it('未知字段默认保留（passthrough，暂不收紧）', () => {
    const req = { body: { student_id: 'S1', password: 'x', extra: 1 } };
    const next = vi.fn();
    validateBody(schemas.loginWithPassword)(req, {}, next);
    expect(req.body.extra).toBe(1);
  });
});

describe('关键 schema 约束', () => {
  const run = (schema, body) => schema.safeParse(body);

  it('请假申请要求 type/start_time/end_time', () => {
    expect(run(schemas.leaveApply, { type: '早操' }).success).toBe(false);
    expect(run(schemas.leaveApply, { type: '早操', start_time: 'a', end_time: 'b' }).success).toBe(true);
  });

  it('投票至少两个选项', () => {
    expect(run(schemas.voteCreate, { title: 't', start_time: 'a', end_time: 'b', options: ['x'] }).success).toBe(false);
    expect(run(schemas.voteCreate, { title: 't', start_time: 'a', end_time: 'b', options: ['x', 'y'] }).success).toBe(true);
  });

  it('建议内容至少 5 字', () => {
    expect(run(schemas.suggestionSubmit, { content: '太短' }).success).toBe(false);
    expect(run(schemas.suggestionSubmit, { content: '这是一条足够长的建议' }).success).toBe(true);
  });

  it('设置密码至少 6 位', () => {
    expect(run(schemas.setPassword, { phone: '138', code: '123456', password: '12345' }).success).toBe(false);
    expect(run(schemas.setPassword, { phone: '138', code: '123456', password: '123456' }).success).toBe(true);
  });

  it('积分需要 user_id/score/reason', () => {
    expect(run(schemas.pointsAdd, { user_id: 1, score: 1 }).success).toBe(false);
    expect(run(schemas.pointsAdd, { user_id: 1, score: 1, reason: 'x' }).success).toBe(true);
  });
});
