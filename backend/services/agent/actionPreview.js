/**
 * 写操作的风险分级与人话描述
 *
 * 为什么要有这个模块：
 * 原来所有写操作共用一张卡片，内容是 `工具名 | {"title":"...","content":"..."}`（一段 JSON），
 * 配一个「确认执行」按钮。问题不是"用户可能不看"，而是**这张卡片本身没有可看的东西**——
 * JSON 里没有影响面、没有后果、没有"这条会推送给谁"。人不会读它，只会点。
 *
 * 所以这里做三件事：
 * 1. **分级**：不是所有写操作都值得打断用户。全都弹卡片 = 全都不看（确认疲劳）。
 *    低风险直接办（配合可撤销），中风险轻确认，高风险强摩擦。
 * 2. **说人话**：用业务语言复述"将要发生什么"，不暴露字段名。
 * 3. **影响面**：由**后端查真实数据**算出来（会推送给多少人、改谁的积分），
 *    绝不让模型自己说——模型说的数字不可信，而这是用户判断要不要点的唯一依据。
 */
const db = require('../../config/database');
const { resolveScope } = require('../../shared/scope');

/** 高风险：影响他人 / 不可逆 / 面向全员 */
const HIGH_RISK_NAMES = new Set([
  'publish_notice', 'approve_leave', 'approve_expense', 'add_points',
  'pending_leave_approvals', 'pending_fee_approvals'
]);

/** 低风险：只影响自己、可自纠、有审批链兜底 —— 不值得打断 */
const LOW_RISK_NAMES = new Set([
  'submit_suggestion', 'create_psychological', 'my_profile'
]);

/** 字段名 → 人话（卡片上不该出现英文 key） */
const FIELD_LABELS = {
  title: '标题', content: '内容', type: '类型', is_todo: '需要成员确认', is_pinned: '置顶',
  start_time: '开始时间', end_time: '结束时间', reason: '事由', type_: '类型',
  amount: '金额', purpose: '用途', details: '明细', semester: '学期', proof_url: '凭证',
  score: '分值', user_id: '成员', notes: '批注', date: '日期', keyword: '关键词',
  name: '名称', description: '说明', category: '分类', class_id: '区队', status: '状态',
  id: '编号', ids: '编号', attachments: '附件'
};

function humanField(k) {
  return FIELD_LABELS[k] || k;
}

/** 值太长就截断——卡片是给人扫一眼的，不是给人读全文的 */
function short(v, max = 60) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s === undefined || s === null) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * 确认策略：哪些操作值得打断用户
 *
 * auto   直接办，不回卡片——只给**后果无害且只影响自己**的操作。
 *        注意判据不是"能撤销"：提交匿名建议没有删除端点，但它的最坏后果只是一条噪音，
 *        所以它可以 auto；而销假虽然只影响自己，后果是考勤状态，不能 auto。
 * confirm 回卡片（默认）
 * strict  回卡片 + 额外摩擦（必须勾选核对 / 微信里必须回短码）
 */
function policyFor(risk) {
  if (risk === 'low') return 'auto';
  if (risk === 'high') return 'strict';
  return 'confirm';
}

/** 风险分级：静态名单 + HTTP 方法兜底规则 */
function classify(tool, args) {
  if (!tool) return 'high'; // 未知工具一律当高危
  if (tool.kind === 'local') return 'low';
  if (tool.kind === 'module') {
    const action = String((args && args.action) || '');
    const method = action.split(' ')[0].toUpperCase();
    if (method === 'DELETE') return 'high'; // 删除一律高危（不可逆）
    if (method === 'GET') return 'low';
    // 模块工具的写操作没有业务语义信息，保守按高危处理
    return HIGH_RISK_NAMES.has(tool.name) ? 'high' : 'high';
  }
  if (HIGH_RISK_NAMES.has(tool.name)) return 'high';
  if (LOW_RISK_NAMES.has(tool.name)) return 'low';
  return 'medium';
}

/**
 * 通知/公告的可见范围**不是由工具参数决定的**，而是服务端按作者作用域盖章
 * （`stampClassId('notices', id, scope.writeClassId)`）：
 *   - 区队干部（role 1-7）与学员 → 归属本区队，**只有本区队可见**
 *   - 超管/辅导员（role >= 8）→ writeClassId = null，全局可见
 * 所以影响面必须按**作者的作用域**算，不能想当然写成"全中队"。
 */
async function audienceOf(user) {
  const fallback = { label: '相关成员', count: null };
  if (!user) return fallback;
  try {
    const scope = await resolveScope(user);
    if (scope.writeClassId === null || scope.writeClassId === undefined) {
      const [rows] = await db.query('SELECT COUNT(*) n FROM users');
      return { label: '全中队', count: rows[0] ? Number(rows[0].n) : null };
    }
    const [rows] = await db.query('SELECT COUNT(*) n FROM users WHERE class_id = ?', [scope.writeClassId]);
    return { label: '本区队', count: rows[0] ? Number(rows[0].n) : null };
  } catch (e) {
    return fallback; // 查不到就不编数字，宁可不显示
  }
}

/**
 * 生成卡片内容。
 * @returns {{summary:string, impact:string, risk:'low'|'medium'|'high', irreversible:boolean}}
 */
async function describe(tool, args, user) {
  const a = args || {};
  const risk = classify(tool, a);
  const name = tool ? tool.name : 'unknown';
  const action = String(a.action || '');
  const method = tool && tool.kind === 'module' ? action.split(' ')[0].toUpperCase() : (tool && tool.method) || '';

  // ---- 面向全员的发布（影响面最大，最需要说清楚） ----
  const isBroadcast =
    name === 'publish_notice' ||
    /\/api\/(notice|announcement)\/create/.test(action) ||
    /\/api\/notice\/create/.test(action);

  if (isBroadcast) {
    // 显式要求全中队时按全中队算；否则按作者作用域（区队干部 → 本区队）
    const aud = a.audience === 'company' ? await audienceOf({ ...user, role: 8 }) : await audienceOf(user);
    // 模型经常只给 content 不给 title，直接显示"(未填标题)"没有信息量——退化成正文前 40 字
    const title = a.title || a.name || (a.content ? short(a.content, 40) : '(未填标题)');
    const who = aud.count !== null ? aud.label + ' ' + aud.count + ' 人' : aud.label + '成员';
    return {
      risk: 'high',
      policy: 'strict',
      irreversible: true,
      summary: '发布' + (name === 'publish_notice' ? '通知' : '公告') + '：' + short(title, 40),
      impact: who + '会收到这条推送，发布后无法撤回'
        + (a.audience === 'company' ? '（全中队）' : '')
    };
  }

  // ---- 审批类：说清批准的是谁、什么时段 ----
  if (/approve/.test(name) || /approve/.test(action)) {
    const parts = [];
    if (a.id) parts.push('记录 #' + a.id);
    if (a.notes) parts.push('批注：' + short(a.notes, 40));
    return {
      risk: 'high',
      policy: 'strict',
      irreversible: false,
      summary: '批准' + (name === 'approve_expense' ? '班费申请' : '请假申请') + (parts.length ? '（' + parts.join('，') + '）' : ''),
      impact: '对方会收到审批通过的通知'
    };
  }

  // ---- 积分加减：说清给谁加多少 ----
  if (name === 'add_points' || /\/api\/points$/.test(action)) {
    const score = a.score;
    return {
      risk: 'high',
      policy: 'strict',
      irreversible: false,
      summary: '给成员 ' + (a.user_id !== undefined ? '#' + a.user_id : '（未指定）') +
        (score !== undefined ? ' ' + (Number(score) >= 0 ? '加 ' : '扣 ') + Math.abs(Number(score)) + ' 分' : ''),
      impact: a.reason ? '事由：' + short(a.reason, 40) + '（对方可见）' : '对方能看到这条加减分记录'
    };
  }

  // ---- 删除类：不可逆，必须点名 ----
  if (method === 'DELETE') {
    return {
      risk: 'high',
      policy: 'strict',
      irreversible: true,
      summary: '删除' + (tool && tool.label ? '：' + tool.label : '') + (a.id ? '（#' + a.id + '）' : ''),
      impact: '删除后无法恢复'
    };
  }

  // ---- 其余：用业务语言复述关键字段 ----
  const keys = [...(tool && tool.pathParams ? tool.pathParams : []), ...(tool && tool.body ? tool.body : []), ...(tool && tool.query ? tool.query : [])];
  const bits = [];
  for (const k of keys) {
    if (a[k] === undefined || a[k] === '' || (Array.isArray(a[k]) && !a[k].length)) continue;
    bits.push(humanField(k) + '：' + short(a[k], 50));
  }
  if (!bits.length && a.params) {
    for (const [k, v] of Object.entries(a.params)) bits.push(humanField(k) + '：' + short(v, 50));
  }
  const label = (tool && (tool.label || tool.name)) || name;
  return {
    risk,
    policy: policyFor(risk),
    irreversible: false,
    summary: label + (bits.length ? '（' + bits.slice(0, 3).join('，') + '）' : ''),
    impact: risk === 'low' ? '' : '提交后可在对应页面查看或更正'
  };
}

module.exports = { describe, classify, policyFor, FIELD_LABELS, humanField };
