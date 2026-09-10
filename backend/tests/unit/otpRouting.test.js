import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { env } = require('../../config/env');
const AuthController = require('../../controllers/AuthController');

const original = { NODE_ENV: process.env.NODE_ENV, provider: env.OTP_PROVIDER, debug: env.OTP_DEBUG_CONSOLE, host: env.SMTP_HOST, user: env.SMTP_USER, pass: env.SMTP_PASS };

function mockRes() {
  return { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

beforeEach(() => {
  process.env.NODE_ENV = 'production';
  env.OTP_DEBUG_CONSOLE = '';
  env.SMTP_HOST = '';
  env.SMTP_USER = '';
  env.SMTP_PASS = '';
});

afterAll(() => {
  process.env.NODE_ENV = original.NODE_ENV;
  env.OTP_PROVIDER = original.provider;
  env.OTP_DEBUG_CONSOLE = original.debug;
  env.SMTP_HOST = original.host;
  env.SMTP_USER = original.user;
  env.SMTP_PASS = original.pass;
});

describe('验证码通道分流（生产环境）', () => {
  it('仅配置 email OTP 时，手机号验证码不应被邮件通道接管（返回 503）', async () => {
    env.OTP_PROVIDER = 'email';
    const res = mockRes();
    await AuthController.sendCode({ body: { phone: '13800138011' } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('短信');
  });

  it('邮箱验证码在 SMTP 未配置时返回 503（不假装成功）', async () => {
    env.OTP_PROVIDER = 'email';
    const res = mockRes();
    await AuthController.sendCode({ body: { email: 'nobody@example.com' } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('邮件');
  });

  it('配置 sms 时手机号验证码进入待接入分支（返回 200 提示已发送）', async () => {
    env.OTP_PROVIDER = 'sms';
    const res = mockRes();
    await AuthController.sendCode({ body: { phone: '13800138012' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('手机号格式非法直接 400', async () => {
    env.OTP_PROVIDER = 'email';
    const res = mockRes();
    await AuthController.sendCode({ body: { phone: '123' } }, res);
    expect(res.statusCode).toBe(400);
  });
});
