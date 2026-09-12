#!/usr/bin/env node
/**
 * 微信主动推送（定时任务）
 *
 * 用法：
 *   node scripts/channel-notify.js                  # 正常跑
 *   node scripts/channel-notify.js --dry-run        # 只打印将要推什么，不发送
 *   node scripts/channel-notify.js --hours 6        # 审批结果回看窗口
 *   node scripts/channel-notify.js --only leave_result
 *
 * 设计纪律（详见 docs/WECHAT_CHANNEL.md §5.4）：
 * - 能合并就合并：多条待审批 → 一条"你有 N 条待审批"，而不是 N 条
 * - 必须可操作：推送里带上"回复『确认』批准"这类指令
 * - 幂等：每类推送都有 dedupe_key，定时任务反复跑不会重复打扰
 * - 每日上限与按类型关闭由 services/channel/notify.js 统一把关
 */
const { env } = require('../config/env');
const db = require('../config/database');
const logger = require('../config/logger');
const { hasPermission } = require('../shared/permissions');
const notify = require('../services/channel/notify');
const { TYPES } = notify;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
}
const DRY = process.argv.includes('--dry-run');
const HOURS = Number(arg('--hours', 3));
const ONLY = arg('--only', '');

const fmtTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 1) 请假审批结果 → 申请人 */
async function collectLeaveResults() {
  const [rows] = await db.query(
    `SELECT l.id, l.user_id, l.status, l.leave_type, l.start_time, l.end_time, l.approval_notes, u.name
       FROM leaves l JOIN users u ON u.id = l.user_id
      WHERE l.status IN (1, 2) AND l.approval_time >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [HOURS]
  );
  return rows.map((r) => ({
    userId: r.user_id,
    type: TYPES.LEAVE_RESULT,
    dedupeKey: 'leave-result-' + r.id,
    text:
      (r.status === 1 ? '✅ 你的请假已通过' : '❌ 你的请假被驳回') +
      '\n类型：' + (r.leave_type || '—') +
      '\n时段：' + fmtTime(r.start_time) + ' ~ ' + fmtTime(r.end_time) +
      (r.approval_notes ? '\n批注：' + r.approval_notes : '') +
      (r.status === 1 ? '\n归队后记得回系统销假。' : '')
  }));
}

/** 2) 待审批请假 → 干部（按区队汇总成一条） */
async function collectPendingLeaves() {
  // leaves 表没有 class_id：区队要经申请人关联（通知/公告才有 class_id 列）
  const [groups] = await db.query(
    `SELECT u.class_id AS class_id, COUNT(*) n
       FROM leaves l JOIN users u ON u.id = l.user_id
      WHERE l.status = 0 AND l.is_cancelled = 0
      GROUP BY u.class_id`
  );
  if (!groups.length) return [];
  // 待审批的申请人区队
  const [cadres] = await db.query(
    "SELECT id, role, class_id FROM users WHERE role BETWEEN 1 AND 9 AND class_id IS NOT NULL"
  );
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (const g of groups) {
    const n = Number(g.n);
    if (!n) continue;
    for (const c of cadres) {
      if (Number(c.role) < 8 && String(c.class_id) !== String(g.class_id)) continue;
      if (!hasPermission({ role: c.role }, 'APPROVE_LEAVE')) continue;
      out.push({
        userId: c.id,
        type: TYPES.LEAVE_PENDING,
        // 每天每人每区队只提醒一次，避免整天被轰炸
        dedupeKey: 'leave-pending-' + today + '-' + (g.class_id || 'all'),
        text: '📋 有 ' + n + ' 条请假待你审批。\n回复「今天有什么要处理的」我可以逐条列出来，或直接在 App 里审批。'
      });
    }
  }
  return out;
}

/** 3) 作业即将截止 → 未提交的人 */
async function collectHomeworkDue({ windowHours = 24 } = {}) {
  const [hws] = await db.query(
    `SELECT id, title, deadline, class_id FROM homeworks
      WHERE deadline > NOW() AND deadline <= DATE_ADD(NOW(), INTERVAL ? HOUR)`,
    [windowHours]
  );
  const out = [];
  for (const hw of hws) {
    const [users] = await db.query(
      hw.class_id
        ? 'SELECT id FROM users WHERE class_id = ? AND role BETWEEN 0 AND 7'
        : 'SELECT id FROM users WHERE role BETWEEN 0 AND 7',
      hw.class_id ? [hw.class_id] : []
    );
    const [subs] = await db.query('SELECT user_id FROM homework_submissions WHERE homework_id = ?', [hw.id]);
    const done = new Set(subs.map((s) => Number(s.user_id)));
    for (const u of users) {
      if (done.has(Number(u.id))) continue;
      out.push({
        userId: u.id,
        type: TYPES.HOMEWORK_DUE,
        dedupeKey: 'hw-due-' + hw.id,
        text: '⏰ 作业《' + hw.title + '》将于 ' + fmtTime(hw.deadline) + ' 截止，你还没提交。\n回复「作业」可以看详情。'
      });
    }
  }
  return out;
}

/** 4) 班费待缴 → 未缴的人 */
async function collectFeeDue() {
  const [cols] = await db.query(
    "SELECT id, title, amount_per_person, class_id FROM fee_collections WHERE status IN ('collecting', 'active', 'open')"
  );
  const out = [];
  for (const col of cols) {
    const [users] = await db.query(
      col.class_id ? 'SELECT id FROM users WHERE class_id = ? AND role BETWEEN 0 AND 7'
                   : 'SELECT id FROM users WHERE role BETWEEN 0 AND 7',
      col.class_id ? [col.class_id] : []
    );
    const [recs] = await db.query('SELECT user_id FROM fee_collection_records WHERE collection_id = ?', [col.id]);
    const paid = new Set(recs.map((r) => Number(r.user_id)));
    for (const u of users) {
      if (paid.has(Number(u.id))) continue;
      out.push({
        userId: u.id,
        type: TYPES.FEE_DUE,
        dedupeKey: 'fee-due-' + col.id,
        text: '💰 班费「' + col.title + '」待缴 ' + Number(col.amount_per_person || 0).toFixed(2) + ' 元。\n在 App 的「班费」页可以缴纳。'
      });
    }
  }
  return out;
}

const COLLECTORS = {
  leave_result: collectLeaveResults,
  leave_pending: collectPendingLeaves,
  homework_due: collectHomeworkDue,
  fee_due: collectFeeDue
};

(async () => {
  const types = ONLY ? ONLY.split(',') : Object.keys(COLLECTORS);
  let all = [];
  for (const t of types) {
    const fn = COLLECTORS[t];
    if (!fn) { console.warn('[notify] 未知类型：' + t); continue; }
    try {
      const items = await fn();
      console.log('[notify] ' + t + ' → 候选 ' + items.length + ' 条');
      all = all.concat(items);
    } catch (e) {
      console.error('[notify] ' + t + ' 采集失败：' + e.message);
    }
  }

  if (!all.length) { console.log('[notify] 无待推送内容'); process.exit(0); }

  if (DRY) {
    console.log('\n--- DRY RUN（不发送）---');
    const seen = new Set();
    for (const it of all) {
      if (seen.has(it.userId + '|' + it.type)) continue;
      seen.add(it.userId + '|' + it.type);
      console.log('用户 ' + it.userId + ' [' + it.type + ']\n  ' + it.text.replace(/\n/g, '\n  '));
    }
    console.log('\n合计 ' + all.length + ' 条（去重后 ' + seen.size + ' 类）');
    process.exit(0);
  }

  const stat = await notify.pushMany(all);
  console.log('[notify] 已发 ' + stat.sent + '，跳过 ' + stat.skipped + '：' + JSON.stringify(stat.reasons));
  logger.info({ stat, enabled: env.CHANNEL_PUSH_ENABLED }, 'channel notify done');
  process.exit(0);
})().catch((e) => { console.error('NOTIFY_ERROR:', e.message); process.exit(1); });
