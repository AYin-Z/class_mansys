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

function safeBodyDigest(body) {
  if (!body || typeof body !== 'object') return null;
  // 拷一份并清洗密码/敏感字段
  const redact = ['password', 'pwd', 'superAdminPassword', 'token', 'refreshToken', 'secret'];
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (redact.includes(k)) out[k] = '***';
    else if (typeof v === 'string' && v.length > 200) out[k] = v.slice(0, 200) + '…';
    else out[k] = v;
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
          body: safeBodyDigest(req.body),
          params: req.params && Object.keys(req.params).length ? req.params : undefined
        }
      });
    } catch (_) { /* ignore */ }
    return originalJson(payload);
  };

  next();
}

module.exports = operationLogger;
