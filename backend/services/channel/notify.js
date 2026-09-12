/**
 * 微信主动推送
 *
 * 聊天渠道最大的价值是**主动找到人**，而不是等用户来问。但最大的风险也是它——
 * 一旦变成骚扰源就会被屏蔽，之后所有通知都失效。所以纪律必须由这一层保证：
 *
 * 1. **幂等**：`(user_id, dedupe_key)` 唯一键。"作业明天截止"只说一次，
 *    定时脚本反复跑不会重复提醒（实测本系统有作业截止日已过、0 人提交的数据，
 *    没有去重的话会全员刷屏）。
 * 2. **每日上限**：超过 `CHANNEL_PUSH_DAILY_MAX` 只落库不发。
 * 3. **可关闭**：用户在绑定记录里按类型关。
 * 4. **没绑定就不推**：不要为没绑定微信的人做无用的发送尝试。
 */
const db = require('../../config/database');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const ChannelRepo = require('./channelRepo');
const ilink = require('./ilinkClient');

/** 推送类型（用户可按这些名字关闭） */
const TYPES = Object.freeze({
  LEAVE_RESULT: 'leave_result', // 请假审批结果 → 申请人
  LEAVE_PENDING: 'leave_pending', // 有待审批请假 → 干部（汇总一条）
  HOMEWORK_DUE: 'homework_due', // 作业将截止 → 未提交的人
  FEE_DUE: 'fee_due', // 班费待缴 → 未缴的人
  ANNOUNCEMENT: 'announcement' // 公告发布 → 全员
});

let cachedCreds = null;
function loadCreds() {
  if (env.WEIXIN_ACCOUNT_ID && env.WEIXIN_TOKEN) {
    return { account_id: env.WEIXIN_ACCOUNT_ID, token: env.WEIXIN_TOKEN, base_url: env.WEIXIN_BASE_URL };
  }
  try {
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(env.WEIXIN_CREDENTIALS_FILE, 'utf8'));
    if (j.account_id && j.token) return j;
  } catch (e) { /* ignore */ }
  return null;
}
function creds() {
  if (!cachedCreds) cachedCreds = loadCreds();
  return cachedCreds;
}

/**
 * 取用户绑定与偏好。
 * @returns {{externalId:string, prefs:object}|null}
 */
async function bindingOf(userId) {
  const [rows] = await db.query(
    "SELECT external_id, push_prefs FROM agent_channel_bindings WHERE channel = 'weixin' AND user_id = ? AND status = 'active' LIMIT 1",
    [userId]
  );
  if (!rows.length) return null;
  let prefs = rows[0].push_prefs;
  if (typeof prefs === 'string') {
    try { prefs = JSON.parse(prefs); } catch (e) { prefs = null; }
  }
  return { externalId: rows[0].external_id, prefs: prefs || {} };
}

async function sentToday(userId) {
  const [rows] = await db.query(
    "SELECT COUNT(*) n FROM channel_push_log WHERE user_id = ? AND status = 'sent' AND created_at >= CURDATE()",
    [userId]
  );
  return Number(rows[0] && rows[0].n) || 0;
}

/**
 * 推一条给某个用户。
 *
 * @returns {{ok:boolean, reason?:string}}
 */
async function pushToUser(userId, { type, text, dedupeKey }) {
  const uid = Number(userId);
  if (!uid || !type || !text) return { ok: false, reason: 'bad-args' };
  if (String(env.CHANNEL_PUSH_ENABLED) === 'false') return { ok: false, reason: 'disabled' };

  const binding = await bindingOf(uid);
  if (!binding) return { ok: false, reason: 'not-bound' };
  if (binding.prefs && binding.prefs[type] === false) return { ok: false, reason: 'opted-out' };

  // 先落库再发：唯一键挡住重复，也避免"发送成功但日志写失败"导致下次重发
  const key = dedupeKey ? String(dedupeKey).slice(0, 96) : null;
  if (key) {
    try {
      await db.query(
        "INSERT INTO channel_push_log (user_id, channel, type, dedupe_key, status) VALUES (?, 'weixin', ?, ?, 'pending')",
        [uid, type, key]
      );
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') return { ok: false, reason: 'duplicate' };
      throw e;
    }
  }

  const max = Number(env.CHANNEL_PUSH_DAILY_MAX);
  if (max > 0 && (await sentToday(uid)) >= max) {
    await db.query("UPDATE channel_push_log SET status = 'skipped', detail = 'daily-cap' WHERE user_id = ? AND dedupe_key <=> ?", [uid, key]);
    logger.info({ userId: uid, type }, 'channel push skipped: daily cap');
    return { ok: false, reason: 'daily-cap' };
  }

  const c = creds();
  if (!c) return { ok: false, reason: 'no-credentials' };
  try {
    await ilink.sendText({ token: c.token, toUserId: binding.externalId, text: String(text).slice(0, 1800) });
    await db.query("UPDATE channel_push_log SET status = 'sent' WHERE user_id = ? AND dedupe_key <=> ?", [uid, key]);
    logger.info({ userId: uid, type }, 'channel push sent');
    return { ok: true };
  } catch (e) {
    await db.query("UPDATE channel_push_log SET status = 'failed', detail = ? WHERE user_id = ? AND dedupe_key <=> ?", [String(e.message).slice(0, 200), uid, key]);
    logger.warn({ userId: uid, type, err: e.message }, 'channel push failed');
    return { ok: false, reason: 'send-failed' };
  }
}

/** 批量推送并汇总（给脚本用） */
async function pushMany(items) {
  const stat = { sent: 0, skipped: 0, reasons: {} };
  for (const it of items) {
    const r = await pushToUser(it.userId, it);
    if (r.ok) stat.sent += 1;
    else {
      stat.skipped += 1;
      stat.reasons[r.reason || 'unknown'] = (stat.reasons[r.reason || 'unknown'] || 0) + 1;
    }
  }
  return stat;
}

module.exports = { pushToUser, pushMany, bindingOf, TYPES, loadCreds };
