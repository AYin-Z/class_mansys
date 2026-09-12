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

/**
 * 取工具这次的**真实 HTTP 方法+路径**。
 *
 * 模块工具（kind='module'）没有 method/path 字段——它的目标是 `args.action` 里的
 * "POST /api/notice/create"。早期代码直接读 tool.method，于是模型一旦选择模块工具来写库，
 * agent_actions.method 就是 NULL，插入直接报 "Column 'method' cannot be null"，
 * 用户看到的是写操作失败。快捷工具与模块工具指向同一批端点，两种都可能被选中，必须都支持。
 */
function resolveTarget(tool, args) {
  if (!tool) return { method: null, path: null };
  if (tool.kind === 'module') {
    const action = String((args && args.action) || '');
    const idx = action.indexOf(' ');
    if (idx <= 0) return { method: null, path: null };
    return { method: action.slice(0, idx).toUpperCase(), path: action.slice(idx + 1) };
  }
  return { method: tool.method || null, path: tool.path || null };
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

/**
 * 以用户身份直接调一个内部端点（撤销用）。
 * 与 execute 走同一套鉴权头与自调用地址，所以权限矩阵、作用域、审计照旧生效。
 */
async function callApi({ method, path, body, token, conversationId }) {
  const base = (env.SELF_BASE_URL || 'http://127.0.0.1:' + env.PORT).replace(/\/+$/, '');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
    'x-agent': '1'
  };
  if (conversationId) headers['x-agent-conversation'] = String(conversationId);
  const res = await fetch(base + path, {
    method: String(method || 'GET').toUpperCase(),
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
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

module.exports = { resolveRequest, resolveTarget, preview, execute, callApi };
