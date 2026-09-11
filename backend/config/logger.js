const pino = require('pino');
const { env } = require('./env');

/**
 * 敏感查询参数判定：令牌/密钥/口令/验证码等。
 * 用「片段匹配」而不是裸 key/code，避免把 keyword 之类的正常参数误伤。
 */
function isSensitiveQueryKey(key) {
  if (typeof key !== 'string' || key === '') return false;
  return /(token|secret|password|passwd|passcode|credential|signature|api[-_]?key)/i.test(key) ||
    /^(code|otp|pwd|key|sign)$/i.test(key);
}

/** 把查询参数串里敏感项的值替换为 ***（保留参数名，便于排查） */
function sanitizeQueryString(qs) {
  if (typeof qs !== 'string' || qs === '') return qs;
  return qs.split('&').map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return pair;
    const rawKey = pair.slice(0, eq);
    let key = rawKey;
    try { key = decodeURIComponent(rawKey); } catch (_) { /* 非法转义按原样判断 */ }
    return isSensitiveQueryKey(key) ? rawKey + '=***' : pair;
  }).join('&');
}

/**
 * 把 URL 里的敏感查询参数替换为 ***。
 * /uploads 下的资源以 ?token=<JWT> 携带令牌（<img src> 无法带请求头，见 frontend-v3/src/utils/media.ts），
 * 而 pino-http 默认会把 req.url 原样写进访问日志——等于把 24h 令牌落盘。
 * 这里只脱敏敏感参数，保留路径与其余查询参数，便于排查问题。
 */
function sanitizeUrl(value) {
  if (typeof value !== 'string' || value === '') return value;
  const qi = value.indexOf('?');
  if (qi === -1) return value;
  const hashAt = value.indexOf('#', qi);
  const head = value.slice(0, qi + 1);
  const query = hashAt === -1 ? value.slice(qi + 1) : value.slice(qi + 1, hashAt);
  const hash = hashAt === -1 ? '' : value.slice(hashAt);
  return head + sanitizeQueryString(query) + hash;
}

/** 把已解析的 query 对象里的敏感项替换为 ***（pino-std-serializers 会把 req.query 原样输出） */
function sanitizeQueryObject(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return query;
  const out = {};
  for (const key of Object.keys(query)) {
    const value = query[key];
    out[key] = isSensitiveQueryKey(key) && value != null ? '***' : value;
  }
  return out;
}

const loggerOptions = {
  // 测试环境默认静默（需要日志时显式设置 LOG_LEVEL）；生产 info，开发 debug
  level: env.LOG_LEVEL || (env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'class-mansys', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      // URL 兜底：pino-http 的 req 序列化器会输出 url（可能带 ?token=）
      'req.url',
      'url',
      '*.url',
      // 序列化后的 req 还带一份解析好的 query（pino-std-serializers v8），
      // 只靠上面的 url 脱敏不够——?token= 会以 req.query.token 原样落盘
      'req.query',
      '*.query'
    ],
    // censor 用函数：url / query 做局部脱敏（保留可排查的路径与参数名），其余敏感字段整体替换。
    // 注意 pino 先跑 serializers 再跑 redact，所以这里拿到的是序列化后的值。
    censor: (value, path) => {
      const key = Array.isArray(path) && path.length > 0 ? path[path.length - 1] : '';
      if (key === 'url' && typeof value === 'string') return sanitizeUrl(value);
      if (key === 'query') return sanitizeQueryObject(value);
      return '[redacted]';
    }
  },
  serializers: {
    // 非 pino-http 场景（直接 logger.info({ req })）的兜底；pino-http 会覆盖成自带的 req 序列化器，
    // 那种情况下由上面的 redact('req.url' / 'req.query') 负责脱敏。
    req(req) {
      if (!req || typeof req !== 'object') return req;
      return {
        id: req.id,
        method: req.method,
        url: sanitizeUrl(req.url),
        query: sanitizeQueryObject(req.query),
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort
      };
    }
  }
};

const logger = pino(loggerOptions);

/** 构造同配置 logger（destination 为 pino 输出流，level 可覆盖）；供测试与子进程复用 */
function createLogger(destination, level) {
  const options = level ? { ...loggerOptions, level } : loggerOptions;
  return destination ? pino(options, destination) : pino(options);
}

module.exports = logger;
module.exports.sanitizeUrl = sanitizeUrl;
module.exports.sanitizeQueryObject = sanitizeQueryObject;
module.exports.createLogger = createLogger;
