const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { verifyMediaToken } = require('../shared/mediaToken');

/**
 * /uploads 访问控制（P3 + P2-1）
 *
 * 鉴权优先级：
 *   1) Authorization: Bearer <会话 JWT>   —— fetch/下载等能带请求头的场景（行为不变）
 *   2) ?mt=<媒体签名>                     —— 新增：短期（默认 15 分钟）+ 按路径限定（P2-1）
 *   3) ?token=<会话 JWT>                  —— 旧方式，过渡期保留，命中时打 warning 便于观察下线时机
 *
 * 为什么是"Bearer → ?mt= → ?token="：
 *   - 带请求头的调用方（App 内 fetch / 下载）语义最明确，出错应当直接报错而不是悄悄降级；
 *   - ?mt= 是目标形态：泄露后只对单个路径、且只有 15 分钟有效；
 *   - ?token= 是给尚未升级的旧 APK / 老缓存页面留的后路，必须放在最后，并且**可观测**。
 * 一旦请求里带了 ?mt= 就不再回落 ?token=（严格优先级）：否则旧方式永远不会退役，
 * 前端也就一直"签名和会话令牌都能用"，失去替换的意义。
 *
 * ⚠️ 下线路线：观察 legacy ?token= 的 warning 日志量，趋近于 0 后删掉第 3 段兼容分支
 * （前提是旧 APK 已铺开完成）。
 *
 * ⚠️ 关于 P2-2（会话可吊销）：本中间件**不做** token_version 比对。原因：
 *   1) 它在每个图片请求上同步执行；加一次 DB 查询（哪怕有 60s 缓存）会把图片通路变成依赖数据库的异步路径；
 *   2) 现有单测按同步语义断言 next() 被立即调用。
 *   因此会话被吊销后，用**旧格式** ?token= / Bearer 仍能读到媒体，直到令牌自然过期（≤24h）。
 *   这是过渡期的已知残留风险，正解是尽快把媒体访问全部切到 ?mt=（短期签名）；见收尾说明。
 */

/** compat 模式只提示一次，避免刷日志 */
let compatWarned = false;
/** ?token= 的 warning 做限流：每 60s 最多一条，附累计计数 */
let legacyWarnAt = 0;
let legacyCount = 0;
const LEGACY_WARN_INTERVAL_MS = 60 * 1000;

/** 取当前请求对应的媒体路径（去掉 query/hash） */
function requestPath(req) {
  const raw = req.originalUrl || req.url || (req.baseUrl || '') + (req.path || '');
  return String(raw || '').split('#')[0].split('?')[0];
}

/** 命中 legacy ?token= 时记账 + 限流告警（不打印令牌本身） */
function noteLegacyToken(path) {
  legacyCount += 1;
  const now = Date.now();
  if (now - legacyWarnAt < LEGACY_WARN_INTERVAL_MS) return;
  legacyWarnAt = now;
  console.warn(
    '[uploadAuth] 仍有请求使用旧式 ?token=<会话JWT> 访问 /uploads（累计 ' + legacyCount +
      ' 次，最近路径 ' + path + '）。媒体签名 ?mt= 已可用；该计数连续为 0 后即可下线旧兼容分支。'
  );
}

/**
 * 缓存策略（2026-09 文件通路改造）
 *
 * 旧值是 max-age=300：用户每翻一次相册都要重新下载全部图片，
 * 手机上「看完一遍再进来又从头加载」，这是相册体验差的直接原因之一。
 *
 * 现在改为浏览器私有缓存 7 天：这些路径下的文件内容不可变（文件名带时间戳+随机串，永不覆盖），
 * 因此按 URL 缓存是安全的。仍然禁止 CDN 等共享缓存（避免令牌/隐私外泄）。
 *
 * 注：?mt= 只有 15 分钟有效期，但缓存键是完整 URL（含令牌）；令牌过期后前端会换用新 URL，
 * 旧 URL 不再被请求，所以 7 天缓存不会让过期令牌绕过校验。
 */
function grant(req, res, next) {
  // req.path 在挂载点内已被剥离前缀（/albums/x.jpg），因此用 originalUrl 判断
  const isMediaFile = /\/uploads\/(albums|resources|agent|leaves)\//.test(
    req.originalUrl || req.url || ''
  );
  res.set(
    'Cache-Control',
    isMediaFile ? 'private, max-age=604800, immutable' : 'private, max-age=604800'
  );
  return next();
}

/** 校验会话 JWT（签名 + 过期），与旧行为一致 */
function verifySessionToken(token, req, res, next) {
  return jwt.verify(token, env.JWT_SECRET, (err) => {
    if (err) {
      return res.status(403).json({ success: false, error: '无效的认证令牌', code: 'FORBIDDEN' });
    }
    return grant(req, res, next);
  });
}

function requireUploadAccess(req, res, next) {
  // 灰度兼容：旧版 APK 未携带令牌，仍放行（仅日志提示），待新版 APK 铺开后切 strict
  if (env.UPLOAD_AUTH_MODE === 'compat') {
    if (!compatWarned) {
      compatWarned = true;
      console.warn('[uploadAuth] UPLOAD_AUTH_MODE=compat：/uploads 暂未强制鉴权，请在 APK 铺开后切 strict');
    }
    return next();
  }

  const header = req.headers && req.headers['authorization'];
  const bearer = header && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const query = req.query || {};
  const mt = typeof query.mt === 'string' ? query.mt.trim() : '';
  const legacy = typeof query.token === 'string' ? query.token.trim() : '';

  // 1) Authorization: Bearer <会话 JWT>
  if (bearer) return verifySessionToken(bearer, req, res, next);

  // 2) ?mt=<媒体签名>：短期 + 按路径限定
  if (mt) {
    const result = verifyMediaToken(requestPath(req), mt);
    if (result.ok) return grant(req, res, next);
    return res.status(403).json({
      success: false,
      error: result.reason === 'expired' ? '媒体链接已过期，请刷新页面' : '媒体签名无效',
      code: result.reason === 'expired' ? 'MEDIA_TOKEN_EXPIRED' : 'MEDIA_TOKEN_INVALID'
    });
  }

  // 3) ?token=<会话 JWT>：旧方式，过渡期保留（可观测）
  if (legacy) {
    noteLegacyToken(requestPath(req));
    return verifySessionToken(legacy, req, res, next);
  }

  return res.status(401).json({ success: false, error: '未提供认证令牌', code: 'UNAUTHORIZED' });
}

module.exports = requireUploadAccess;
module.exports._internals = { requestPath, grant, legacyStats: () => ({ count: legacyCount }) };
