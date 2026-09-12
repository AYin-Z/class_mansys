/**
 * 写操作撤销
 *
 * 为什么要有：确认卡片拦不住闭眼点击（"大多数人不会仔细看确认卡片"）。
 * 既然拦不住，就必须让**纠错变快**——撤销比事前确认更有效，
 * 因为用户是在**看到结果之后**才知道到底发生了什么。
 *
 * 设计边界：
 * - **只对真有反向端点的操作提供撤销**。没有反向端点的（如提交匿名建议、销假）
 *   不给假的撤销按钮——点了没反应比没有按钮更糟。
 * - 撤销本身也是一次写操作，同样以用户身份走内部 API，权限矩阵照旧生效
 *   （比如撤销通知需要 MANAGE_NOTICE，撤销积分需要 MANAGE_POINTS）。
 */
const env = require('../../config/env');

/**
 * 匹配规则：按**请求方法+路径**匹配，而不是工具名。
 * 因为模块工具的 action 是真实端点，与快捷工具可能命中同一个接口，按工具名匹配会漏。
 */
const RULES = [
  {
    match: (m, p) => m === 'POST' && p === '/api/notice/create',
    build: (id) => ({ method: 'DELETE', path: '/api/notice/' + id, label: '撤回这条通知' })
  },
  {
    match: (m, p) => m === 'POST' && p === '/api/announcement/create',
    build: (id) => ({ method: 'DELETE', path: '/api/announcement/' + id, label: '撤回这条公告' })
  },
  {
    match: (m, p) => m === 'POST' && p === '/api/points',
    build: (id) => ({ method: 'DELETE', path: '/api/points/' + id, label: '撤销这次积分变动' })
  },
  {
    match: (m, p) => m === 'POST' && p === '/api/homework',
    build: (id) => ({ method: 'DELETE', path: '/api/homework/' + id, label: '删除这条作业' })
  }
];

/** 从各种响应形态里取新建资源的 id（各家控制器返回不统一：有的 data.id，有的顶层 id） */
function extractId(resultData) {
  if (!resultData || typeof resultData !== 'object') return null;
  const candidates = [
    resultData.id,
    resultData.insertId,
    resultData.data && resultData.data.id,
    resultData.data && resultData.data.insertId
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * 执行成功后，判断这次操作能不能撤销。
 * @returns {{method:string, path:string, label:string, ttlMs:number} | null}
 */
function planFor({ method, path, resultData }) {
  const m = String(method || '').toUpperCase();
  const p = String(path || '');
  const rule = RULES.find((r) => r.match(m, p));
  if (!rule) return null;
  const id = extractId(resultData);
  if (!id) return null; // 拿不到 id 就不能撤销——不猜
  const plan = rule.build(id);
  return { ...plan, ttlMs: Number(env.AGENT_UNDO_TTL_MS) || 1800000 };
}

/** 是否支持撤销（给文案用，不需要 id） */
function isUndoable(method, path) {
  const m = String(method || '').toUpperCase();
  const p = String(path || '');
  return RULES.some((r) => r.match(m, p));
}

module.exports = { planFor, isUndoable, extractId, RULES };
