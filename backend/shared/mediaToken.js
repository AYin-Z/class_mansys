/**
 * 媒体短期签名令牌（P2-1）
 *
 * 为什么需要它
 * ------------
 * /uploads 下的图片/附件此前只能用 `?token=<会话 JWT>` 访问：
 *   1. 会话 JWT 有效期 24h，会落在网关/CDN 访问日志、Referer、用户复制的图片链接里；
 *   2. 它与具体文件无关 —— 泄露一个就等于泄露该会话能访问的**全部**媒体；
 *   3. 无法针对单个文件失效，也没有"这条链接 15 分钟后自动作废"的能力。
 *
 * 本模块签发「短期 + 按路径限定」的媒体令牌：
 *
 *   token = `${exp}.${sig}`
 *   sig   = base64url(HMAC-SHA256(key, `${path}|${exp}`)).slice(0, 32)
 *   key   = HMAC-SHA256(JWT_SECRET, 'media-v1')     // 从既有密钥派生，不新增必填配置
 *
 * 设计说明
 * --------
 * - 令牌只有 `exp.sig` 两段，**不含 path**：验签时路径由服务端从请求 URL 现取并参与计算，
 *   因此令牌不可移植到别的路径（换路径 → 签名不匹配 → 403）。格式短（≈43 字符），URL 友好。
 * - 派生图策略（重要）：用原图路径签发的令牌，**同时**可以访问 `xxx_thumb.jpg` /
 *   `xxx_medium.jpg`。理由：
 *     * 前端 thumbUrl()/mediumUrl() 是按命名约定**推导**地址的（存量附件只存了原图 URL），
 *       服务端也把三档当作同一个资源的不同规格；
 *     * 若每档单独签名，一个 30 张照片的相册需要 90 个令牌，而 /api/media/sign 单次上限 100，
 *       且存量数据无法提前预取，会让列表页大量回落到旧 ?token= 兜底；
 *     * 三档来自同一张原图，权限边界完全一致，共用签名不会放大任何权限。
 *     实现：优先按请求路径验签，失败再按「原图基路径」验签，两者都不匹配才拒绝。
 * - `userId` 只作为调用方的审计信息（可选），**不参与签名** —— 否则验签方必须知道是哪个用户，
 *   就失去了"媒体链接可以脱离会话独立校验"的意义。
 */
const crypto = require('crypto');
const { env } = require('../config/env');

/** 默认有效期 15 分钟：足够一次页面浏览，短到泄露后基本无用 */
const DEFAULT_TTL_SEC = 900;
/** 上限 1 小时：防止调用方签出"实质上的长期令牌" */
const MAX_TTL_SEC = 3600;
/** 签名取 base64url 前 N 个字符（≈192 bit 熵），与短链接长度折中 */
const SIG_CHARS = 32;
/** 派生密钥的用途标识：日后换算法时改这里即可，不影响 JWT 本身 */
const KEY_INFO = 'media-v1';
/** 只允许 /uploads/ 下的具体文件 */
const MEDIA_PREFIX = '/uploads/';
const MAX_PATH_LENGTH = 512;

/** 派生图后缀：mediaService 生成的是 `xxx_thumb.jpg` / `xxx_medium.jpg` */
const DERIVED_RE = /(?:_(?:thumb|medium))(\.[A-Za-z0-9]+)$/;

let keyCache = { secret: null, key: null };

/**
 * 签名密钥 = HMAC(JWT_SECRET, 'media-v1')。
 * 惰性派生并缓存：既不给每次验签增加开销，也不会因为部署后轮换 JWT_SECRET 而沿用旧密钥
 * （secret 变了就重新派生，旧签名自然失效）。
 */
function signingKey() {
  const secret = String(env.JWT_SECRET || '');
  if (!secret) throw new Error('[mediaToken] JWT_SECRET 未配置，无法签发/校验媒体令牌');
  if (keyCache.secret !== secret) {
    keyCache = { secret, key: crypto.createHmac('sha256', secret).update(KEY_INFO).digest() };
  }
  return keyCache.key;
}

/** 去掉 query/hash，得到用于签名的路径 */
function stripQuery(path) {
  return String(path == null ? '' : path).split('#')[0].split('?')[0];
}

/** 合法媒体路径：/uploads/ 下的具体文件，禁止穿越与空字节（含百分号编码形式） */
function isSafeMediaPath(path) {
  const p = stripQuery(path);
  if (!p || p.length > MAX_PATH_LENGTH) return false;
  if (!p.startsWith(MEDIA_PREFIX) || p.length <= MEDIA_PREFIX.length) return false;

  let decoded;
  try {
    // 非法百分号编码直接拒绝，避免"编码绕过 + 下游再解码"的组合攻击
    decoded = decodeURIComponent(p);
  } catch {
    return false;
  }
  for (const candidate of [p, decoded]) {
    if (candidate.includes('..') || candidate.includes('\0') || candidate.includes('\\')) return false;
  }
  return true;
}

/** 派生图 → 原图基路径（`/uploads/a_thumb.jpg` → `/uploads/a.jpg`） */
function basePathOf(path) {
  return stripQuery(path).replace(DERIVED_RE, '$1');
}

function clampTtl(ttlSec) {
  const n = Number(ttlSec);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_SEC;
  return Math.min(Math.floor(n), MAX_TTL_SEC);
}

function sign(path, exp) {
  return crypto
    .createHmac('sha256', signingKey())
    .update(path + '|' + exp)
    .digest('base64url')
    .slice(0, SIG_CHARS);
}

/** 定长比较，避免时序侧信道 */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * 签发媒体令牌
 * @param {string} path 形如 `/uploads/albums/1699999_ab12.jpg`（可带 query，会被忽略）
 * @param {{ttlSec?: number, userId?: number|string}} [options]
 * @returns {string} `exp.sig`，直接作为 `?mt=` 的取值
 */
function signMediaToken(path, options = {}) {
  if (!isSafeMediaPath(path)) {
    const err = new Error('非法的媒体路径');
    err.code = 'BAD_MEDIA_PATH';
    throw err;
  }
  const exp = Math.floor(Date.now() / 1000) + clampTtl(options.ttlSec);
  return exp + '.' + sign(stripQuery(path), exp);
}

/** 候选路径：请求路径本身、（百分号）解码后、以及各自的原图基路径 */
function candidatePaths(requested) {
  const out = [];
  const push = (p) => {
    if (p && out.indexOf(p) === -1) out.push(p);
  };
  push(requested);
  push(basePathOf(requested));
  let decoded;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    decoded = '';
  }
  if (decoded && decoded !== requested) {
    push(decoded);
    push(basePathOf(decoded));
  }
  return out;
}

/**
 * 校验媒体令牌
 * @param {string} path 请求的媒体路径（`/uploads/...`，可带 query）
 * @param {string} token `exp.sig`
 * @returns {{ok: boolean, reason: string, exp?: number, matchedPath?: string, derived?: boolean}}
 *   reason: ok | missing | malformed | expired | path-mismatch
 */
function verifyMediaToken(path, token) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const exp = Number(parts[0]);
  const sig = parts[1];
  if (!Number.isInteger(exp) || exp <= 0) return { ok: false, reason: 'malformed' };
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(sig)) return { ok: false, reason: 'malformed' };

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp <= nowSec) return { ok: false, reason: 'expired', exp };

  const requested = stripQuery(path);
  for (const candidate of candidatePaths(requested)) {
    if (!isSafeMediaPath(candidate)) continue;
    if (safeEqual(sign(candidate, exp), sig)) {
      return {
        ok: true,
        reason: 'ok',
        exp,
        matchedPath: candidate,
        // true 表示这条令牌是按原图路径签发的、被用在了派生图上（见文件头"派生图策略"）
        derived: candidate !== requested
      };
    }
  }
  // 签名对不上：要么签名被篡改，要么令牌本来就不是给这个路径签的（含跨用户拿别人的令牌）
  return { ok: false, reason: 'path-mismatch', exp };
}

module.exports = {
  DEFAULT_TTL_SEC,
  MAX_TTL_SEC,
  MEDIA_PREFIX,
  isSafeMediaPath,
  basePathOf,
  signMediaToken,
  verifyMediaToken,
  _internals: { signingKey, candidatePaths, clampTtl }
};
