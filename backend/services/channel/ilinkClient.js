const crypto = require('crypto');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { HttpError } = require('../../shared/http');

/**
 * 腾讯 iLink Bot API 客户端（普通微信个人号通道，Hermes 同款协议）
 *
 * - 长轮询拉消息：POST ilink/bot/getupdates  { get_updates_buf }
 * - 发送消息：    POST ilink/bot/sendmessage { msg: { to_user_id, item_list, context_token } }
 * - 扫码登录：    GET  ilink/bot/get_bot_qrcode / ilink/bot/get_qrcode_status
 *
 * 注意：iLink 是「机器人身份」，通常无法被拉进普通微信群（群事件多数不下发），实践中可靠的只有私聊。
 */
const ILINK_APP_ID = 'bot';
const CHANNEL_VERSION = '2.2.0';
const ILINK_APP_CLIENT_VERSION = (2 << 16) | (2 << 8) | 0; // 131584
const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';
const MSG_TYPE_BOT = 2;
const MSG_STATE_FINISH = 2;
const ITEM_TEXT = 1;

const EP_GET_UPDATES = 'ilink/bot/getupdates';
const EP_SEND_MESSAGE = 'ilink/bot/sendmessage';
const EP_GET_BOT_QR = 'ilink/bot/get_bot_qrcode';
const EP_GET_QR_STATUS = 'ilink/bot/get_qrcode_status';

function baseUrl() {
  return String(env.WEIXIN_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function buildHeaders(token, body) {
  const uin = Buffer.from(String(crypto.randomBytes(4).readUInt32BE(0))).toString('base64');
  const headers = {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    'X-WECHAT-UIN': uin,
    'iLink-App-Id': ILINK_APP_ID,
    'iLink-App-ClientVersion': String(ILINK_APP_CLIENT_VERSION)
  };
  if (body) headers['Content-Length'] = String(Buffer.byteLength(body, 'utf8'));
  if (token) headers.Authorization = 'Bearer ' + token;
  return headers;
}

function buildBody(payload) {
  return JSON.stringify({ ...payload, base_info: { channel_version: CHANNEL_VERSION } });
}

async function apiPost(endpoint, payload, { token, timeoutMs = 15000, base } = {}) {
  const body = buildBody(payload);
  const url = (base || baseUrl()) + '/' + endpoint;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: buildHeaders(token, body), body, signal: controller.signal });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text.slice(0, 500) }; }
    if (!res.ok) {
      logger.warn({ endpoint, status: res.status }, 'ilink api error');
      throw new HttpError(502, '微信通道请求失败（HTTP ' + res.status + '）', 'ILINK_HTTP_ERROR');
    }
    return data;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e.name === 'AbortError') throw e; // 长轮询超时由调用方处理
    logger.warn({ endpoint, err: e.message }, 'ilink request error');
    throw new HttpError(502, '微信通道不可用：' + e.message, 'ILINK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

async function apiGet(endpoint, { timeoutMs = 15000, base } = {}) {
  const url = (base || baseUrl()) + '/' + endpoint;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'iLink-App-Id': ILINK_APP_ID, 'iLink-App-ClientVersion': String(ILINK_APP_CLIENT_VERSION) },
      signal: controller.signal
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return { raw: text.slice(0, 500) }; }
  } finally {
    clearTimeout(timer);
  }
}

/** 长轮询拉取新消息；超时返回空结果（协议正常行为） */
async function getUpdates({ token, syncBuf = '', timeoutMs = 35000 } = {}) {
  try {
    return await apiPost(EP_GET_UPDATES, { get_updates_buf: syncBuf }, { token, timeoutMs });
  } catch (e) {
    if (e.name === 'AbortError' || e.code === 'ABORT_ERR') return { ret: 0, msgs: [], get_updates_buf: syncBuf };
    throw e;
  }
}

function extractText(itemList) {
  for (const item of Array.isArray(itemList) ? itemList : []) {
    if (item && Number(item.type) === ITEM_TEXT) {
      const t = (item.text_item || {}).text || '';
      if (t) return String(t);
    }
  }
  return '';
}

/** 发送文本消息（必须回显对方最新的 context_token） */
async function sendText({ token, toUserId, text, contextToken, clientId } = {}) {
  if (!text || !text.trim()) throw new HttpError(400, 'text 不能为空', 'BAD_REQUEST');
  const msg = {
    from_user_id: '',
    to_user_id: toUserId,
    client_id: clientId || crypto.randomUUID(),
    message_type: MSG_TYPE_BOT,
    message_state: MSG_STATE_FINISH,
    item_list: [{ type: ITEM_TEXT, text_item: { text: String(text).slice(0, 1800) } }]
  };
  if (contextToken) msg.context_token = contextToken;
  return apiPost(EP_SEND_MESSAGE, { msg }, { token });
}

/** 扫码登录：获取二维码 */
async function fetchQrCode(botType = 3) {
  return apiGet(EP_GET_BOT_QR + '?bot_type=' + encodeURIComponent(botType), { timeoutMs: 35000 });
}

/** 扫码登录：轮询状态（wait / scaned / scaned_but_redirect / confirmed / expired） */
async function pollQrStatus(qrcode, base) {
  return apiGet(EP_GET_QR_STATUS + '?qrcode=' + encodeURIComponent(qrcode), { timeoutMs: 35000, base });
}

module.exports = {
  ILINK_APP_ID, CHANNEL_VERSION, ILINK_APP_CLIENT_VERSION, DEFAULT_BASE_URL,
  EP_GET_UPDATES, EP_SEND_MESSAGE, EP_GET_BOT_QR, EP_GET_QR_STATUS,
  buildHeaders, buildBody, apiPost, apiGet, getUpdates, sendText, extractText, fetchQrCode, pollQrStatus, baseUrl
};
