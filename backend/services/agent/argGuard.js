/**
 * 工具参数守卫（执行前的确定性校验与类型纠正）
 *
 * 为什么需要：小模型经常把必填字段漏掉、把布尔写成字符串 'false'。
 * 不拦的话，请求会打到后端，用户看到的是 `title: Invalid input: expected string, received undefined`
 * 这种**面向开发者的报错**——既看不懂，也不知道该怎么办。
 * 实测（本地 4B，团支书发通知）模型给出的参数：
 *   { type:'普通通知', content:'…', is_todo:'false', is_pinned:'false', audience:'company' }
 * 少了必填的 title，且两个布尔是字符串。
 *
 * 这里做两件确定性的事：
 * 1. **类型纠正**：'true'/'false' → 布尔；纯数字字符串 → 数字（按 schema 的类型提示）
 * 2. **必填校验**：缺字段就**不发起请求**，把"缺哪些"回给模型让它补（模型在循环里，能自己补）
 *
 * 属于"用确定性代码弥补小模型的不确定性"，比换更大的模型便宜得多。
 */

/** 字段名 → 期望类型（与 toOpenAiTools 的 schema 保持一致） */
const BOOLEAN_FIELDS = new Set(['is_todo', 'is_pinned', 'auto_approve', 'notify']);
const NUMBER_FIELDS = new Set(['id', 'user_id', 'score', 'amount', 'limit', 'page', 'pageSize', 'class_id', 'company_id', 'status', 'priority']);

/** 把 'true'/'false'、数字字符串纠正成真实类型；空字符串视为未填 */
function coerceValue(key, value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (BOOLEAN_FIELDS.has(key) && /^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
    if (NUMBER_FIELDS.has(key) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    return value;
  }
  return value;
}

/**
 * @returns {{args:object, missing:string[], coerced:string[]}}
 */
function guard(tool, args) {
  const a = { ...(args || {}) };
  const coerced = [];
  const changed = [];

  // 模块工具的参数在 params 里，一并纠正
  if (tool && tool.kind === 'module') {
    if (a.params && typeof a.params === 'object') {
      const p = { ...a.params };
      for (const k of Object.keys(p)) {
        const v = coerceValue(k, p[k]);
        if (v !== p[k]) { p[k] = v; changed.push('params.' + k); }
      }
      a.params = p;
    }
    return { args: a, missing: [], coerced: changed };
  }

  for (const k of Object.keys(a)) {
    const v = coerceValue(k, a[k]);
    if (v !== a[k]) { a[k] = v; coerced.push(k); }
  }

  // 必填：优先用工具显式声明的 required，否则回落到 body 里的关键字段
  const required = Array.isArray(tool && tool.required) && tool.required.length
    ? tool.required
    : [...(tool && tool.pathParams ? tool.pathParams : [])];
  const missing = required.filter((k) => a[k] === undefined || a[k] === null || a[k] === '' || (Array.isArray(a[k]) && !a[k].length));

  return { args: a, missing, coerced };
}

module.exports = { guard, coerceValue, BOOLEAN_FIELDS, NUMBER_FIELDS };
