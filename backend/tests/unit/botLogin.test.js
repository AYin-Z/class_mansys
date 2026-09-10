import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const { env } = require('../../config/env');
const BotLogin = require('../../services/channel/botLogin');
const { BotLoginService } = require('../../services/channel/botLogin');

const tmpFile = path.join(os.tmpdir(), 'class-mansys-test-weixin.json');
const original = env.WEIXIN_CREDENTIALS_FILE;

function stubClient(overrides = {}) {
  return Object.assign({
    baseUrl: () => 'https://ilinkai.weixin.qq.com',
    fetchQrCode: async () => ({ qrcode: 'QR123', qrcode_img_content: 'https://liteapp.weixin.qq.com/q/abc?qrcode=QR123' }),
    pollQrStatus: async () => ({ status: 'wait' })
  }, overrides);
}

beforeEach(() => {
  env.WEIXIN_CREDENTIALS_FILE = tmpFile;
  env.WEIXIN_ACCOUNT_ID = '';
  env.WEIXIN_TOKEN = '';
  try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  // worker 拉起在单测里打桩，避免真的去动 systemd
  vi.spyOn(BotLoginService, 'restartWorker').mockResolvedValue('active');
});

afterEach(() => {
  env.WEIXIN_CREDENTIALS_FILE = original;
  try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  vi.restoreAllMocks();
});

describe('微信机器人扫码登录（站内流程）', () => {
  it('start 返回可直接渲染的二维码 data URL', async () => {
    const r = await BotLogin.start(stubClient());
    expect(r.status).toBe('wait');
    expect(r.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(r.expiresInSec).toBe(300);
    expect(r.url).toContain('liteapp.weixin.qq.com');
  });

  it('未扫码时状态为 wait，扫码未确认为 scaned', async () => {
    await BotLogin.start(stubClient());
    expect((await BotLogin.status(stubClient())).status).toBe('wait');
    expect((await BotLogin.status(stubClient({ pollQrStatus: async () => ({ status: 'scaned' }) }))).status).toBe('scaned');
  });

  it('扫码后重定向会切换到新的 host', async () => {
    await BotLogin.start(stubClient());
    const s = await BotLogin.status(stubClient({ pollQrStatus: async () => ({ status: 'scaned_but_redirect', redirect_host: 'szilink.weixin.qq.com' }) }));
    expect(s.status).toBe('scaned');
  });

  it('二维码过期返回 expired', async () => {
    await BotLogin.start(stubClient());
    const s = await BotLogin.status(stubClient({ pollQrStatus: async () => ({ status: 'expired' }) }));
    expect(s.status).toBe('expired');
  });

  it('确认后落盘凭证（600）并上报 worker 状态', async () => {
    await BotLogin.start(stubClient());
    const s = await BotLogin.status(stubClient({
      pollQrStatus: async () => ({
        status: 'confirmed',
        ilink_bot_id: 'bot_account_123',
        bot_token: 'secret_token',
        baseurl: 'https://ilinkai.weixin.qq.com',
        ilink_user_id: 'user_1'
      })
    }));
    expect(s.status).toBe('confirmed');
    expect(s.worker).toBe('active');
    const creds = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(creds.account_id).toBe('bot_account_123');
    expect(creds.token).toBe('secret_token');
    expect(fs.statSync(tmpFile).mode & 0o777).toBe(0o600);
  });

  it('确认但凭证不完整时报错且不落盘', async () => {
    await BotLogin.start(stubClient());
    await expect(BotLogin.status(stubClient({ pollQrStatus: async () => ({ status: 'confirmed', ilink_bot_id: 'x' }) })))
      .rejects.toThrow(/凭证不完整/);
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it('connection() 只暴露账号前缀，不泄露 token', async () => {
    BotLoginService.saveCredentials({ account_id: 'bot_account_123456', token: 'secret_token', base_url: 'https://x' });
    const c = BotLogin.connection();
    expect(c.connected).toBe(true);
    expect(c.accountId).toContain('…');
    expect(JSON.stringify(c)).not.toContain('secret_token');
  });

  it('未登录时 connection() 为未连接', () => {
    expect(BotLogin.connection().connected).toBe(false);
  });

  it('没有会话时 status 返回 none', async () => {
    const svc = new BotLoginService();
    expect((await svc.status(stubClient())).status).toBe('none');
  });
});
