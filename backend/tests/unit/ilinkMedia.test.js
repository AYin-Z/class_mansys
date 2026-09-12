import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const m = require('../../services/channel/ilinkMedia');
const crypto = require('crypto');

describe('iLink 媒体：加解密', () => {
  it('AES-128-ECB + PKCS7 往返一致', () => {
    const key = crypto.randomBytes(16);
    for (const len of [0, 1, 15, 16, 17, 1000]) {
      const plain = crypto.randomBytes(len);
      const ct = m.aesEncrypt(plain, key);
      expect(ct.length % 16).toBe(0);
      expect(m.aesDecrypt(ct, key).equals(plain)).toBe(true);
    }
  });

  it('padding 后长度符合 _aes_padded_size（总是补 1..16 字节）', () => {
    expect(m.pkcs7PadSize(0)).toBe(16);
    expect(m.pkcs7PadSize(15)).toBe(16);
    expect(m.pkcs7PadSize(16)).toBe(32);
    expect(m.pkcs7PadSize(17)).toBe(32);
  });

  it('aeskey 两种形态都要认：16 字节原始 / 32 位 hex 字符串', () => {
    const raw = crypto.randomBytes(16);
    expect(m.parseAesKey(raw.toString('base64')).equals(raw)).toBe(true);
    const hexB64 = Buffer.from(raw.toString('hex'), 'ascii').toString('base64');
    expect(m.parseAesKey(hexB64).equals(raw)).toBe(true);
  });

  it('发送侧的 aes_key 必须是 base64(hex 字符串)——给成 base64(原始字节) 图片会变灰块', () => {
    const key = crypto.randomBytes(16);
    const forApi = Buffer.from(key.toString('hex'), 'ascii').toString('base64');
    // 解出来应当是 32 个 hex 字符，而不是 16 个原始字节
    expect(Buffer.from(forApi, 'base64').length).toBe(32);
    expect(m.parseAesKey(forApi).equals(key)).toBe(true);
  });
});

describe('iLink 媒体：CDN 地址与 item 解析', () => {
  it('下载/上传地址构造正确', () => {
    expect(m.cdnDownloadUrl('https://cdn.example/c2c', 'a b')).toBe('https://cdn.example/c2c/download?encrypted_query_param=a%20b');
    expect(m.cdnUploadUrl('https://cdn.example/c2c/', 'p', 'k')).toBe('https://cdn.example/c2c/upload?encrypted_query_param=p&filekey=k');
  });

  it('从 item_list 挑出图片/文件/语音，忽略纯文本', () => {
    const items = [
      { type: m.ITEM.TEXT, text_item: { text: '这是请假证明' } },
      { type: m.ITEM.IMAGE, image_item: { media: { encrypt_query_param: 'Q', aes_key: 'K' }, mid_size: 123 } },
      { type: m.ITEM.FILE, file_item: { media: { encrypt_query_param: 'Q2' }, file_name: '证明.pdf', len: '456' } },
      { type: m.ITEM.VOICE, voice_item: { media: { encrypt_query_param: 'Q3' }, text: '语音转写内容' } }
    ];
    const out = m.extractMediaItems(items);
    expect(out.map((x) => x.kind)).toEqual(['image', 'file', 'voice']);
    expect(out[1].filename).toBe('证明.pdf');
    expect(out[2].voiceText).toBe('语音转写内容'); // 语音自带转写，可直接当文本
  });

  it('media_type 编号与 item 类型不是一套（容易混）', () => {
    expect(m.mediaTypeFor('image', 'image/jpeg')).toBe(m.MEDIA.IMAGE); // 1
    expect(m.mediaTypeFor('video', 'video/mp4')).toBe(m.MEDIA.VIDEO); // 2
    expect(m.mediaTypeFor('file', 'application/pdf')).toBe(m.MEDIA.FILE); // 3
    expect(m.mediaTypeFor('voice', 'audio/silk')).toBe(m.MEDIA.VOICE); // 4
    expect(m.ITEM.IMAGE).toBe(2); // item 类型里图片是 2
  });

  it('发送 item 结构与协议一致', () => {
    const item = m.buildMediaItem('image', 'image/jpeg', {
      encryptedQueryParam: 'EQ', aesKeyForApi: 'AK', ciphertextSize: 32, plaintextSize: 20, filename: 'a.jpg', rawfilemd5: 'md5'
    });
    expect(item.type).toBe(m.ITEM.IMAGE);
    expect(item.image_item.media).toEqual({ encrypt_query_param: 'EQ', aes_key: 'AK', encrypt_type: 1 });
    expect(item.image_item.mid_size).toBe(32);
  });

  it('未知后缀按文件类型、MIME 兜底', () => {
    expect(m.guessMime('a.png', 'image')).toBe('image/png');
    expect(m.guessMime('a.xyz', 'image')).toBe('image/jpeg');
    expect(m.guessMime('a.xyz', 'file')).toBe('application/octet-stream');
  });
});

describe('iLink 媒体：下载解密', () => {
  it('下载后按 aeskey 解密', async () => {
    const key = crypto.randomBytes(16);
    const plain = Buffer.from('请假证明图片内容');
    const ct = m.aesEncrypt(plain, key);
    const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => ct });
    const out = await m.downloadMedia(
      { encryptedQueryParam: 'Q', aesKeyB64: key.toString('base64') },
      { fetchImpl, cdnBaseUrl: 'https://cdn.example/c2c' }
    );
    expect(out.toString()).toBe('请假证明图片内容');
  });

  it('没有密钥时原样返回（不报错）', async () => {
    const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => Buffer.from('raw') });
    const out = await m.downloadMedia({ encryptedQueryParam: 'Q' }, { fetchImpl });
    expect(out.toString()).toBe('raw');
  });
});
