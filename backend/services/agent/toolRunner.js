const { env } = require('../../config/env');
const { BadRequestError } = require('../../shared/http');

/** 解析工具调用的实际 HTTP 请求 */
function resolveRequest(tool, args) {
  const a = args || {};
  if (tool.kind === 'module') {
    const action = String(a.action || '');
    if (!tool.actions.includes(action)) throw new BadRequestError('不支持的 action：' + action);
    const idx = action.indexOf(' ');
    const method = action.slice(0, idx);
    const path = action.slice(idx + 1);
    return {
      method,
      path,
      body: method === 'GET' ? undefined : a.params || {},
      query: method === 'GET' ? a.query || a.params || {} : undefined
    };
  }
  let path = tool.path;
  for (const k of tool.pathParams || []) {
    if (a[k] === undefined || a[k] === null || a[k] === '') throw new BadRequestError('缺少参数 ' + k);
    path = path.replace('{' + k + '}', encodeURIComponent(String(a[k])));
  }
  const body = {};
  for (const k of tool.body || []) if (a[k] !== undefined) body[k] = a[k];
  const query = {};
  for (const k of tool.query || []) if (a[k] !== undefined && a[k] !== '') query[k] = a[k];
  const isGet = tool.method === 'GET';
  return { method: tool.method, path, body: isGet ? undefined : body, query: isGet ? query : undefined };
}

/** 人类可读的动作预览（用于确认卡片） */
function preview(tool, args) {
  const a = args || {};
  const parts = [];
  if (tool.kind === 'module') {
    parts.push(a.action || '');
    if (a.params && Object.keys(a.params).length) parts.push(JSON.stringify(a.params));
    return parts.join(' ');
  }
  parts.push(tool.label || tool.name);
  const detail = {};
  for (const k of [...(tool.pathParams || []), ...(tool.body || []), ...(tool.query || [])]) {
    if (a[k] !== undefined && a[k] !== '') detail[k] = a[k];
  }
  if (Object.keys(detail).length) parts.push(JSON.stringify(detail));
  return parts.join(' | ').slice(0, 480);
}

/**
 * 以「用户身份」调用系统内部 API：
 * 权限、作用域、zod 校验、操作审计全部复用同一套中间件，天然不会越权。
 */
async function execute(tool, args, ctx) {
  // 本地工具：不发起 HTTP，直接执行（如系统使用引导）
  if (tool.kind === 'local' && typeof tool.handler === 'function') {
    return { status: 200, ok: true, data: await tool.handler(args || {}) };
  }
  const req = resolveRequest(tool, args);
  const base = (env.SELF_BASE_URL || 'http://127.0.0.1:' + env.PORT).replace(/\/+$/, '');
  const qs = req.query && Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + ctx.token,
    'x-agent': '1'
  };
  if (ctx.conversationId) headers['x-agent-conversation'] = String(ctx.conversationId);

  const res = await fetch(base + req.path + qs, {
    method: req.method,
    headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text.slice(0, 2000) };
  }
  return { status: res.status, ok: res.ok, data };
}

module.exports = { resolveRequest, preview, execute };
