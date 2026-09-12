const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { env } = require('../config/env');

/**
 * 认证域服务（P2）：验证码存储、令牌签发/校验、密码哈希与校验、目标归一化。
 * 控制器只负责 HTTP 契约与流程编排。
 */

// 内存验证码存储（开发/小规模使用；生产环境应换 Redis）
const VERIFICATION_CODES = new Map();
const CODE_EXPIRE_MS = 5 * 60 * 1000;
const SEND_CODE_LIMITS = new Map();
const SEND_CODE_WINDOW_MS = 60 * 1000;
const SEND_CODE_MAX_PER_WINDOW = 3;
const MAX_CODE_ATTEMPTS = 5;

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function otpConfig() {
  return {
    provider: env.OTP_PROVIDER || '',
    debugConsole: env.OTP_DEBUG_CONSOLE === 'true'
  };
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeCode(phoneOrEmail, code) {
  VERIFICATION_CODES.set(phoneOrEmail, { code, expiresAt: Date.now() + CODE_EXPIRE_MS, attempts: 0 });
}

function verifyCode(phoneOrEmail, inputCode) {
  const entry = VERIFICATION_CODES.get(phoneOrEmail);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    VERIFICATION_CODES.delete(phoneOrEmail);
    return false;
  }
  if (entry.attempts >= MAX_CODE_ATTEMPTS) {
    VERIFICATION_CODES.delete(phoneOrEmail);
    return false;
  }
  if (entry.code === inputCode) return true;
  entry.attempts += 1;
  if (entry.attempts >= MAX_CODE_ATTEMPTS) VERIFICATION_CODES.delete(phoneOrEmail);
  return false;
}

function clearCode(phoneOrEmail) {
  VERIFICATION_CODES.delete(phoneOrEmail);
}

function canSendCode(target) {
  const now = Date.now();
  const current = SEND_CODE_LIMITS.get(target);
  if (!current || now > current.resetAt) {
    SEND_CODE_LIMITS.set(target, { count: 1, resetAt: now + SEND_CODE_WINDOW_MS });
    return true;
  }
  if (current.count >= SEND_CODE_MAX_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

function normalizeTarget({ phone, email } = {}) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedPhone) {
    if (!PHONE_RE.test(normalizedPhone)) return { error: '手机号码格式不正确' };
    return { target: normalizedPhone, type: 'phone' };
  }
  if (normalizedEmail) {
    if (!EMAIL_RE.test(normalizedEmail)) return { error: '邮箱格式不正确' };
    return { target: normalizedEmail, type: 'email' };
  }
  return { error: '手机号或邮箱不能为空' };
}

function fallbackStudentId(prefix, value) {
  const digest = crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
  return prefix + '_' + digest;
}

/**
 * 签发会话 JWT
 *
 * P2-2：带上 tv = 该用户当前的 users.token_version。校验端（middleware/auth.js）会用它
 * 判断令牌是否已被"改密/重置密码/移出"作废。注意调用方必须在 token_version 变更**之后**
 * 重新读取用户再签发，否则会签出一个立刻就失效的令牌（见 AuthController.changePassword）。
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      openid: user.openid,
      role: user.role,
      isAdmin: user.role > 0,
      class_id: user.class_id || null,
      // 老用户对象（未查 token_version 字段）按 0 处理，与迁移前的语义一致
      tv: Number(user.token_version || 0)
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(user, plain) {
  if (!user || !user.password_hash) return Promise.resolve(false);
  return bcrypt.compare(plain, user.password_hash);
}

function scheduleVerificationCleanup() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of VERIFICATION_CODES) {
      if (now > entry.expiresAt) VERIFICATION_CODES.delete(k);
    }
    for (const [k, entry] of SEND_CODE_LIMITS) {
      if (now > entry.resetAt) SEND_CODE_LIMITS.delete(k);
    }
  }, 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
scheduleVerificationCleanup();

module.exports = {
  PHONE_RE,
  EMAIL_RE,
  otpConfig,
  generateCode,
  storeCode,
  verifyCode,
  clearCode,
  canSendCode,
  normalizeTarget,
  fallbackStudentId,
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword
};
