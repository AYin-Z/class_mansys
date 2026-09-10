const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const QRCode = require('qrcode');
const ilink = require('./ilinkClient');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { BadRequestError } = require('../../shared/http');

const SESSION_TTL_MS = 5 * 60 * 1000;
const UNIT = 'class-mansys-ilink';

/**
 * 微信机器人身份登录（超管在站内扫码）
 *
 * 与 scripts/ilink-login.js 的区别：这里把「扫码 → 确认 → 保存凭证 → 拉起 worker」
 * 搬到站内页面，管理员不需要登录服务器。协议与凭证格式完全一致。
 */
class BotLoginService {
  constructor() {
    this.session = null; // { qrcode, url, baseUrl, createdAt, status, accountId }
  }

  /** 生成二维码（返回可直接 <img src> 的 data URL） */
  async start(client = ilink) {
    const res = await client.fetchQrCode(3);
    if (!res || !res.qrcode) throw new BadRequestError('无法获取微信二维码，请稍后重试');
    const url = String(res.qrcode_img_content || '');
    const qrDataUrl = await QRCode.toDataURL(url || String(res.qrcode), { margin: 1, width: 320 });
    this.session = {
      qrcode: String(res.qrcode),
      url,
      baseUrl: client.baseUrl ? client.baseUrl() : ilink.baseUrl(),
      createdAt: Date.now(),
      status: 'wait',
      accountId: null
    };
    logger.info({ hasUrl: !!url }, 'weixin bot login started');
    return { status: 'wait', qrDataUrl, url, expiresInSec: Math.round(SESSION_TTL_MS / 1000) };
  }

  /** 轮询扫码状态；确认后落盘凭证并尝试拉起 worker */
  async status(client = ilink) {
    const s = this.session;
    if (!s) return { status: 'none' };
    if (Date.now() - s.createdAt > SESSION_TTL_MS && s.status !== 'confirmed') {
      s.status = 'expired';
      return { status: 'expired' };
    }
    if (s.status === 'confirmed') return { status: 'confirmed', accountId: s.accountId, ...this.connection() };

    const res = await client.pollQrStatus(s.qrcode, s.baseUrl);
    const st = String((res && res.status) || 'wait');
    if (st === 'scaned_but_redirect' && res.redirect_host) {
      s.baseUrl = 'https://' + res.redirect_host;
      s.status = 'scaned';
      return { status: 'scaned' };
    }
    if (st === 'expired') {
      s.status = 'expired';
      return { status: 'expired' };
    }
    if (st === 'confirmed') {
      const accountId = String(res.ilink_bot_id || '');
      const token = String(res.bot_token || '');
      if (!accountId || !token) throw new BadRequestError('登录已确认但凭证不完整，请重试');
      const creds = {
        account_id: accountId,
        token,
        base_url: String(res.baseurl || s.baseUrl || ilink.DEFAULT_BASE_URL),
        user_id: String(res.ilink_user_id || '')
      };
      BotLoginService.saveCredentials(creds);
      s.status = 'confirmed';
      s.accountId = accountId;
      const worker = await BotLoginService.restartWorker();
      logger.info({ accountId: accountId.slice(0, 8) + '…', worker }, 'weixin bot login confirmed');
      return { status: 'confirmed', accountId, worker, ...this.connection() };
    }
    s.status = st === 'scaned' ? 'scaned' : 'wait';
    return { status: s.status };
  }

  /** 当前连接状态（不返回 token） */
  connection() {
    const creds = BotLoginService.readCredentials();
    return {
      connected: !!creds,
      accountId: creds ? String(creds.account_id || '').slice(0, 12) + '…' : null,
      baseUrl: creds ? creds.base_url || env.WEIXIN_BASE_URL : null,
      credentialsFile: env.WEIXIN_CREDENTIALS_FILE
    };
  }

  static readCredentials() {
    if (env.WEIXIN_ACCOUNT_ID && env.WEIXIN_TOKEN) {
      return { account_id: env.WEIXIN_ACCOUNT_ID, token: env.WEIXIN_TOKEN, base_url: env.WEIXIN_BASE_URL };
    }
    try {
      const j = JSON.parse(fs.readFileSync(env.WEIXIN_CREDENTIALS_FILE, 'utf8'));
      return j && j.account_id && j.token ? j : null;
    } catch (e) {
      return null;
    }
  }

  static saveCredentials(creds) {
    const file = env.WEIXIN_CREDENTIALS_FILE;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(creds, null, 2), { mode: 0o600 });
    return file;
  }

  /** worker 是否在跑（systemd 用户单元；未安装时返回 unknown） */
  static workerState() {
    return new Promise((resolve) => {
      execFile('systemctl', ['--user', 'is-active', UNIT], { timeout: 5000 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        resolve(out || (err ? 'unknown' : 'unknown'));
      });
    });
  }

  /** 登录成功后拉起 worker（单元未安装则忽略，页面会提示） */
  static restartWorker() {
    return new Promise((resolve) => {
      execFile('systemctl', ['--user', 'restart', UNIT], { timeout: 10000 }, async (err) => {
        if (err) return resolve('unknown');
        resolve(await BotLoginService.workerState());
      });
    });
  }
}

module.exports = new BotLoginService();
module.exports.BotLoginService = BotLoginService;
