import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ilink = require('../../services/channel/ilinkClient');

describe('iLink 客户端协议构造', () => {
  it('请求头符合协议（iLink-App-Id / ClientVersion / X-WECHAT-UIN / AuthorizationType）', () => {
    const h = ilink.buildHeaders('tok', '{}');
    expect(h['iLink-App-Id']).toBe('bot');
    expect(h['iLink-App-ClientVersion']).toBe(String((2 << 16) | (2 << 8) | 0));
    expect(h.AuthorizationType).toBe('ilink_bot_token');
    expect(h.Authorization).toBe('Bearer tok');
    expect(h['Content-Type']).toBe('application/json');
    const uin = Buffer.from(h['X-WECHAT-UIN'], 'base64').toString('utf8');
    expect(/^\d+$/.test(uin)).toBe(true);
    expect(h['Content-Length']).toBe(String(Buffer.byteLength('{}', 'utf8')));
  });

  it('无 token 时不带 Authorization', () => {
    expect(ilink.buildHeaders('', '{}').Authorization).toBeUndefined();
  });

  it('请求体自动包裹 base_info.channel_version', () => {
    const body = JSON.parse(ilink.buildBody({ get_updates_buf: 'abc' }));
    expect(body.get_updates_buf).toBe('abc');
    expect(body.base_info.channel_version).toBe('2.2.0');
  });

  it('extractText 只取 type=1 的 text_item', () => {
    expect(ilink.extractText([{ type: 1, text_item: { text: '你好' } }])).toBe('你好');
    expect(ilink.extractText([{ type: 2, image_item: {} }])).toBe('');
    expect(ilink.extractText([{ type: 2 }, { type: 1, text_item: { text: 'ok' } }])).toBe('ok');
    expect(ilink.extractText(null)).toBe('');
  });

  it('端点常量与 Hermes 实现一致', () => {
    expect(ilink.EP_GET_UPDATES).toBe('ilink/bot/getupdates');
    expect(ilink.EP_SEND_MESSAGE).toBe('ilink/bot/sendmessage');
    expect(ilink.EP_GET_BOT_QR).toBe('ilink/bot/get_bot_qrcode');
    expect(ilink.EP_GET_QR_STATUS).toBe('ilink/bot/get_qrcode_status');
    expect(ilink.DEFAULT_BASE_URL).toBe('https://ilinkai.weixin.qq.com');
  });
});
