/**
 * 会话可吊销：token_version 比对 + 进程内缓存（P2-2）
 *
 * 问题：JWT 是无状态的，签发后 24h 内一直有效 —— 改密码、管理员重置密码、成员被移出后，
 * 旧令牌仍然能继续访问（令牌泄露时只能干等过期）。
 *
 * 方案：users.token_version 记录"令牌代次"。
 *   - 签发时把当前值写进 JWT 的 tv 声明（services/authService.signToken）；
 *   - 每次请求比对 tv 与库里的当前值，不一致 → 401「登录状态已失效，请重新登录」；
 *   - 改密 / 重置密码 / 移出 / 删除时 +1（见 controllers/AuthController.js、services/adminMembers.js）。
 *
 * 兼容：迁移前签发的旧令牌没有 tv 声明 → 视为 0。这样迁移上线后已登录用户不会被立刻踢下线；
 * 但该用户一旦发生"代次变更"，其旧令牌（0）与新值不一致就会失效 —— 正是期望的行为。
 *
 * 性能：每个请求都查库不可接受（/api 全站都会走 authenticateToken）。因此做进程内缓存
 * （userId → { tv, expireAt }，TTL 60s），并在 +1 / 删除用户时立即清掉对应条目。
 * 代价：**最长 60s 的吊销窗口** —— 期间旧令牌仍可能通过（见收尾说明的残留风险）。
 *
 * 降级：读取失败（DB 抖动 / 迁移未应用导致 Unknown column）时**放行并告警**，
 * 避免一次数据库抖动把全体在线用户打成 401；失败后 10s 内不再重试（防止每个请求都打库）。
 */
const db = require('../config/database');

/** 缓存 TTL：60s 内同一用户的请求不再打库 */
const DEFAULT_TTL_MS = 60 * 1000;
/** 读取失败后的退避时间：这段时间内直接放行、不再尝试查询 */
const ERROR_BACKOFF_MS = 10 * 1000;

/** tv 归一化：缺失/非法 → 0（老令牌） */
function normalizeTv(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * 构造一个独立的守卫实例（便于单测注入假的数据源与时钟）
 * @param {{ttlMs?: number, errorBackoffMs?: number, now?: () => number, log?: object,
 *          readVersion: (userId: number) => Promise<number|null>,
 *          bumpVersion?: (userId: number) => Promise<number|null>}} options
 */
function createTokenVersionGuard(options = {}) {
  const ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : DEFAULT_TTL_MS;
  const errorBackoffMs = Number(options.errorBackoffMs) > 0 ? Number(options.errorBackoffMs) : ERROR_BACKOFF_MS;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const log = options.log || console;
  const readVersion = options.readVersion;
  const bumpVersion = options.bumpVersion;

  if (typeof readVersion !== 'function') throw new Error('[tokenVersion] 缺少 readVersion');
  if (typeof bumpVersion !== 'function') throw new Error('[tokenVersion] 缺少 bumpVersion');

  /** userId → { tv: number|null, expireAt }（tv=null 表示"用户不存在"） */
  const cache = new Map();
  /** userId → 退避截止时间（读取失败后短时间不再打库） */
  const errorUntil = new Map();
  let dbReads = 0;

  /** 取当前 tv（带缓存）；返回 null 表示用户不存在 */
  async function getVersion(userId) {
    const id = Number(userId);
    const hit = cache.get(id);
    const t = now();
    if (hit && hit.expireAt > t) return hit.tv;

    dbReads += 1;
    const raw = await readVersion(id);
    const tv = raw === null || raw === undefined ? null : normalizeTv(raw);
    cache.set(id, { tv, expireAt: now() + ttlMs });
    return tv;
  }

  /** 清掉某用户的缓存（tv 变更 / 用户被删时调用） */
  function invalidate(userId) {
    const id = Number(userId);
    cache.delete(id);
    errorUntil.delete(id);
  }

  /** 清空全部缓存（测试 / 运维用） */
  function clear() {
    cache.clear();
    errorUntil.clear();
  }

  /**
   * 校验 JWT payload 的 tv 是否仍然有效
   * @returns {{ok: boolean, reason: string, tv?: number, expected?: number, got?: number, degraded?: boolean}}
   *   reason: ok | no-user | user-missing | tv-mismatch | db-error
   */
  async function check(payload) {
    const rawId = payload ? (payload.id != null ? payload.id : payload.userId) : null;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: 'no-user' };

    // 老令牌没有 tv 声明 → 视为 0
    const claim = normalizeTv(payload.tv);

    const t = now();
    const backoffUntil = errorUntil.get(id);
    if (backoffUntil && backoffUntil > t) {
      return { ok: true, reason: 'db-error', degraded: true, cached: true };
    }

    let current;
    try {
      current = await getVersion(id);
    } catch (err) {
      errorUntil.set(id, now() + errorBackoffMs);
      log.warn({ err: err && err.message, userId: id }, '[tokenVersion] 读取失败，本次请求降级放行');
      return { ok: true, reason: 'db-error', degraded: true, error: err && err.message };
    }

    if (current === null) return { ok: false, reason: 'user-missing' };
    if (current !== claim) return { ok: false, reason: 'tv-mismatch', expected: current, got: claim };
    return { ok: true, reason: 'ok', tv: current };
  }

  /** tv + 1 并清缓存；返回新值（用户不存在返回 null） */
  async function bump(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return null;
    invalidate(id);
    const tv = await bumpVersion(id);
    invalidate(id);
    return tv === null || tv === undefined ? null : normalizeTv(tv);
  }

  return {
    check,
    getVersion,
    bump,
    invalidate,
    clear,
    cacheSize: () => cache.size,
    stats: () => ({ dbReads, cacheSize: cache.size })
  };
}

/** 生产用实例：直连 users 表 */
const guard = createTokenVersionGuard({
  readVersion: async (userId) => {
    const [rows] = await db.query('SELECT token_version FROM users WHERE id = ?', [userId]);
    if (!rows.length) return null;
    return normalizeTv(rows[0].token_version);
  },
  bumpVersion: async (userId) => {
    await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
    const [rows] = await db.query('SELECT token_version FROM users WHERE id = ?', [userId]);
    if (!rows.length) return null;
    return normalizeTv(rows[0].token_version);
  }
});

module.exports = {
  DEFAULT_TTL_MS,
  ERROR_BACKOFF_MS,
  createTokenVersionGuard,
  normalizeTv,
  checkTokenVersion: (payload) => guard.check(payload),
  getTokenVersion: (userId) => guard.getVersion(userId),
  bumpTokenVersion: (userId) => guard.bump(userId),
  invalidateTokenVersion: (userId) => guard.invalidate(userId),
  _clearTokenVersionCache: () => guard.clear(),
  _stats: () => guard.stats()
};
