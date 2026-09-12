/**
 * iLink（微信）媒体收发
 *
 * 背景：我们的客户端原来只解析 `type === 1`（文本），用户发请假证明照片、相册照片过去
 * **什么都没发生也没有任何提示**——最糟的一种失败（用户以为发出去了）。
 * 协议本身完整支持媒体，权威参考是本机 Hermes 的 `gateway/platforms/weixin.py`：
 *
 *   item 类型：1 文本 / 2 图片 / 3 语音 / 4 文件 / 5 视频
 *   getuploadurl 的 media_type：1 图片 / 2 视频 / 3 文件 / 4 语音（与 item 类型不是一套编号，别混）
 *   媒体通道：AES-128-ECB 加密的 CDN
 *     下载 GET  {cdn}/download?encrypted_query_param=…
 *     上传 POST {cdn}/upload?encrypted_query_param=…&filekey=…   密文作 body，响应头 x-encrypted-param
 *
 * 两个容易踩的坑（Hermes 注释里写明了，照抄避免重踩）：
 * 1. **`aes_key` 要给 base64(hex 字符串)，不是 base64(原始字节)**。给错了接收方解密不匹配，
 *    图片显示成灰块。
 * 2. **上传一律用 POST**。早期对 `upload_full_url` 用 PUT 会在微信 CDN 上 404。
 */
const crypto = require('crypto');

/** item_list 里的项类型 */
const ITEM = { TEXT: 1, IMAGE: 2, VOICE: 3, FILE: 4, VIDEO: 5 };
/** getuploadurl 的 media_type（与 ITEM 不是同一套编号） */
const MEDIA = { IMAGE: 1, VIDEO: 2, FILE: 3, VOICE: 4 };

/** 微信 CDN 基址（Hermes 内置默认值） */
const DEFAULT_CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c';

/** item 类型 → 取哪个字段里的 media / 属于哪类附件 */
const ITEM_MEDIA_KEY = {
  [ITEM.IMAGE]: 'image_item',
  [ITEM.VOICE]: 'voice_item',
  [ITEM.FILE]: 'file_item',
  [ITEM.VIDEO]: 'video_item'
};

function pkcs7PadSize(size) {
  return ((size + 1 + 15) >> 4) << 4;
}

function pkcs7Pad(buf) {
  const pad = 16 - (buf.length % 16);
  return Buffer.concat([buf, Buffer.alloc(pad, pad)]);
}

function pkcs7Unpad(buf) {
  if (!buf.length) return buf;
  const pad = buf[buf.length - 1];
  if (pad >= 1 && pad <= 16 && buf.subarray(buf.length - pad).equals(Buffer.alloc(pad, pad))) {
    return buf.subarray(0, buf.length - pad);
  }
  return buf;
}

function aesEncrypt(plaintext, key) {
  const c = crypto.createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([c.update(pkcs7Pad(plaintext)), c.final()]);
}

function aesDecrypt(ciphertext, key) {
  const d = crypto.createDecipheriv('aes-128-ecb', key, null);
  return pkcs7Unpad(Buffer.concat([d.update(ciphertext), d.final()]));
}

/**
 * 解析 aeskey。收到的媒体里 aeskey 是 base64，解出来可能是
 * 16 字节原始密钥，也可能是 32 个 hex 字符（再转 16 字节）。
 */
function parseAesKey(b64) {
  const decoded = Buffer.from(String(b64 || ''), 'base64');
  if (decoded.length === 16) return decoded;
  if (decoded.length === 32) {
    const text = decoded.toString('ascii');
    if (/^[0-9a-fA-F]{32}$/.test(text)) return Buffer.from(text, 'hex');
  }
  throw new Error('unexpected aes_key format (' + decoded.length + ' bytes)');
}

function cdnDownloadUrl(cdnBaseUrl, encryptedQueryParam) {
  const base = String(cdnBaseUrl || DEFAULT_CDN_BASE_URL).replace(/\/+$/, '');
  return base + '/download?encrypted_query_param=' + encodeURIComponent(encryptedQueryParam);
}

function cdnUploadUrl(cdnBaseUrl, uploadParam, filekey) {
  const base = String(cdnBaseUrl || DEFAULT_CDN_BASE_URL).replace(/\/+$/, '');
  return (
    base + '/upload?encrypted_query_param=' + encodeURIComponent(uploadParam) +
    '&filekey=' + encodeURIComponent(filekey)
  );
}

/** 从 item_list 里挑出媒体项（文本项交给 extractText） */
function extractMediaItems(itemList) {
  const out = [];
  for (const item of itemList || []) {
    const type = Number(item && item.type);
    const key = ITEM_MEDIA_KEY[type];
    if (!key) continue;
    const holder = item[key] || {};
    const media = holder.media || {};
    out.push({
      type,
      kind: type === ITEM.IMAGE ? 'image' : type === ITEM.VIDEO ? 'video' : type === ITEM.VOICE ? 'voice' : 'file',
      encryptedQueryParam: media.encrypt_query_param || null,
      fullUrl: media.full_url || null,
      aesKeyB64: media.aes_key || null,
      filename: holder.file_name || null,
      // 语音消息自带转写文本，可直接当文本用（Hermes 就是这么做的）
      voiceText: holder.text || null,
      size: Number(holder.mid_size || holder.len || holder.video_size || 0) || 0
    });
  }
  return out;
}

/** 下载 + 解密一个媒体项，返回 Buffer */
async function downloadMedia(ref, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  let url;
  if (ref.encryptedQueryParam) {
    url = cdnDownloadUrl(opts.cdnBaseUrl, ref.encryptedQueryParam);
  } else if (ref.fullUrl) {
    url = ref.fullUrl;
  } else {
    throw new Error('media item had neither encrypt_query_param nor full_url');
  }
  const res = await fetchImpl(url, { signal: opts.signal });
  if (!res.ok) throw new Error('CDN download HTTP ' + res.status);
  let buf = Buffer.from(await res.arrayBuffer());
  if (ref.aesKeyB64) buf = aesDecrypt(buf, parseAesKey(ref.aesKeyB64));
  return buf;
}

/** 按文件名/类型猜 MIME */
function guessMime(filename, kind) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', zip: 'application/zip', silk: 'audio/silk', amr: 'audio/amr'
  };
  if (map[ext]) return map[ext];
  if (kind === 'image') return 'image/jpeg';
  if (kind === 'video') return 'video/mp4';
  if (kind === 'voice') return 'audio/silk';
  return 'application/octet-stream';
}

/** kind → getuploadurl 的 media_type */
function mediaTypeFor(kind, mime) {
  if (String(mime || '').startsWith('image/') || kind === 'image') return MEDIA.IMAGE;
  if (String(mime || '').startsWith('video/') || kind === 'video') return MEDIA.VIDEO;
  if (String(mime || '').startsWith('audio/') || kind === 'voice') return MEDIA.VOICE;
  return MEDIA.FILE;
}

/** 组装发送用的 item（字段与 Hermes 的 _outbound_media_builder 对齐） */
function buildMediaItem(kind, mime, kw) {
  const media = {
    encrypt_query_param: kw.encryptedQueryParam,
    aes_key: kw.aesKeyForApi,
    encrypt_type: 1
  };
  if (String(mime || '').startsWith('image/') || kind === 'image') {
    return { type: ITEM.IMAGE, image_item: { media, mid_size: kw.ciphertextSize } };
  }
  if (String(mime || '').startsWith('video/') || kind === 'video') {
    return {
      type: ITEM.VIDEO,
      video_item: { media, video_size: kw.ciphertextSize, play_length: 0, video_md5: kw.rawfilemd5 }
    };
  }
  if (String(mime || '').startsWith('audio/') || kind === 'voice') {
    return { type: ITEM.VOICE, voice_item: { media, encode_type: 6, sample_rate: 24000, bits_per_sample: 16, playtime: 0 } };
  }
  return { type: ITEM.FILE, file_item: { media, file_name: kw.filename, len: String(kw.plaintextSize) } };
}

/**
 * 上传一份媒体并发送。
 *
 * @param {object} p
 * @param {function} p.apiPost    ilinkClient.apiPost（带鉴权头）
 * @param {string} p.token
 * @param {string} p.toUserId
 * @param {string} [p.contextToken]
 * @param {Buffer} p.buffer       明文
 * @param {string} p.filename
 * @param {string} [p.kind]       image|file|video|voice
 * @param {string} [p.cdnBaseUrl]
 * @returns {Promise<{encryptedQueryParam:string, ciphertextSize:number}>}
 */
async function uploadAndSend(p) {
  const fetchImpl = p.fetchImpl || fetch;
  const cdnBaseUrl = p.cdnBaseUrl || DEFAULT_CDN_BASE_URL;
  const mime = p.mime || guessMime(p.filename, p.kind);
  const kind = p.kind || (mime.startsWith('image/') ? 'image' : 'file');
  const plaintext = p.buffer;
  const filekey = crypto.randomBytes(16).toString('hex');
  const aesKey = crypto.randomBytes(16);
  const rawfilemd5 = crypto.createHash('md5').update(plaintext).digest('hex');

  const upload = await p.apiPost(
    'ilink/bot/getuploadurl',
    {
      filekey,
      media_type: mediaTypeFor(kind, mime),
      to_user_id: p.toUserId,
      rawsize: plaintext.length,
      rawfilemd5,
      filesize: pkcs7PadSize(plaintext.length),
      no_need_thumb: true,
      aeskey: aesKey.toString('hex')
    },
    { token: p.token }
  );

  const uploadParam = String((upload && upload.upload_param) || '');
  const uploadFullUrl = String((upload && upload.upload_full_url) || '');
  if (!uploadParam && !uploadFullUrl) {
    throw new Error('getuploadurl returned neither upload_param nor upload_full_url');
  }
  const ciphertext = aesEncrypt(plaintext, aesKey);
  // 上传一律 POST（对 upload_full_url 用 PUT 会在微信 CDN 上 404）
  const url = uploadFullUrl || cdnUploadUrl(cdnBaseUrl, uploadParam, filekey);
  const upRes = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: ciphertext
  });
  if (!upRes.ok) throw new Error('CDN upload HTTP ' + upRes.status);
  const encryptedQueryParam = upRes.headers.get('x-encrypted-param');
  if (!encryptedQueryParam) throw new Error('CDN upload missing x-encrypted-param header');

  // 关键：aes_key 必须是 base64(hex 字符串)，给 base64(原始字节) 接收方会显示灰块
  const aesKeyForApi = Buffer.from(aesKey.toString('hex'), 'ascii').toString('base64');
  const item = buildMediaItem(kind, mime, {
    encryptedQueryParam,
    aesKeyForApi,
    ciphertextSize: ciphertext.length,
    plaintextSize: plaintext.length,
    filename: p.filename || 'file.bin',
    rawfilemd5
  });

  await p.apiPost(
    'ilink/bot/sendmessage',
    {
      msg: {
        from_user_id: '',
        to_user_id: p.toUserId,
        client_id: 'class-mansys-' + crypto.randomUUID().replace(/-/g, ''),
        message_type: 2,
        message_state: 2,
        item_list: [item],
        ...(p.contextToken ? { context_token: p.contextToken } : {})
      }
    },
    { token: p.token }
  );

  return { encryptedQueryParam, ciphertextSize: ciphertext.length };
}

module.exports = {
  ITEM,
  MEDIA,
  DEFAULT_CDN_BASE_URL,
  pkcs7PadSize,
  pkcs7Pad,
  pkcs7Unpad,
  aesEncrypt,
  aesDecrypt,
  parseAesKey,
  cdnDownloadUrl,
  cdnUploadUrl,
  extractMediaItems,
  downloadMedia,
  uploadAndSend,
  guessMime,
  mediaTypeFor,
  buildMediaItem
};
