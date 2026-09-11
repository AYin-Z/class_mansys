const OperationLog = require('../models/OperationLog');

/**
 * 粗粒度操作记录中间件
 *
 * 策略：
 * - 只记录写操作（POST/PUT/DELETE）
 * - 以 "/api/<moduleName>/..." 中的 moduleName 作为 resource_type
 * - 通过接管 res.json 推断状态（success / error）
 * - 写日志失败不影响响应
 *
 * 对业务无感知侵入，完整业务细节可通过 req.body 的关键字段选择性落库
 */
function inferResourceType(urlPath) {
  // /api/leave/apply -> leave
  const m = (urlPath || '').match(/^\/api\/([^\/\?]+)/);
  return m ? m[1] : null;
}

function inferAction(method, urlPath) {
  // 常见 RESTful 尾段作为 action 语义提示
  const tail = (urlPath || '').split('?')[0].split('/').filter(Boolean).pop();
  const verb = method.toLowerCase();
  if (!tail) return verb;
  return `${verb}:${tail}`;
}

/**
 * 敏感模块：正文内容一律不进审计日志
 *
 * 事故背景：审计日志曾把心理申请、匿名建议、留言的正文原样写进
 * operation_logs.detail.body.content，而 /api/admin/operations（VIEW_ROSTER=角色1..9）
 * 又会原样返回 detail —— 等于任何区队干部都能反查匿名内容。
 */
const SENSITIVE_PATH_RE = /^\/api\/(psychological|suggestion|message|auth)(\/|$)/;
/** 只保留这些"非正文"字段，其余一律丢弃 */
const SAFE_FIELDS = ['amount', 'type', 'status', 'leave_type', 'start_time', 'end_time', 'reason_code', 'score', 'category', 'is_todo'];

function safeBodyDigest(body, path) {
  if (!body || typeof body !== 'object') return null;
  if (SENSITIVE_PATH_RE.test(String(path || ''))) {
    // 敏感模块：只记字段名与长度，不记内容
    const keys = Object.keys(body);
    return { redacted: true, fields: keys.map((k) => k + ':' + String(body[k] === undefined ? '' : String(body[k]).length)) };
  }
  const redact = ['password', 'pwd', 'superAdminPassword', 'token', 'refreshToken', 'secret'];
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (redact.includes(k)) out[k] = '***';
    else if (typeof v === 'string' && v.length > 200) out[k] = v.slice(0, 200) + '…';
    else if (v && typeof v === 'object') out[k] = '[object]';
    else out[k] = v;
  }
  // 附加白名单外的长文本字段（如 content/notes/details）做截断保护
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string' && out[k].length > 200) out[k] = out[k].slice(0, 200) + '…';
  }
  if (!SAFE_FIELDS.some((f) => f in out) && Object.keys(out).length > 12) {
    return { redacted: true, fields: Object.keys(out).slice(0, 12) };
  }
  return out;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

function operationLogger(req, res, next) {
  const method = (req.method || '').toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return next();
  }

  // /api/auth/login 等未认证接口也可以记录，但此时没有 user_id
  const originalJson = res.json.bind(res);
  res.json = function patchedJson(payload) {
    try {
      const userId = req.user?.id || null;
      const resourceType = inferResourceType(req.originalUrl || req.url);
      const action = inferAction(method, req.path);
      const success = !!payload?.success;
      OperationLog.create({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: payload?.id || payload?.leaveId || payload?.userId || null,
        method,
        path: (req.originalUrl || req.url || '').slice(0, 200),
        status_code: res.statusCode,
        ip: getClientIp(req),
        detail: {
          success,
          error: payload?.error,
          body: safeBodyDigest(req.body, req.originalUrl || req.url),
          params: req.params && Object.keys(req.params).length ? req.params : undefined
        }
      });
    } catch (_) { /* ignore */ }
    return originalJson(payload);
  };

  next();
}

module.exports = operationLogger;
