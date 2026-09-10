const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

/**
 * /uploads 访问控制（P3）
 * - 支持 Authorization: Bearer <token>（fetch / 下载）
 * - 支持 ?token=<token>（<img src> 无法带请求头，前端用 utils/media.ts 追加）
 * - 未认证 401；令牌无效 403
 */
let compatWarned = false;

function requireUploadAccess(req, res, next) {
  // 灰度兼容：旧版 APK 未携带令牌，仍放行（仅日志提示），待新版 APK 铺开后切 strict
  if (env.UPLOAD_AUTH_MODE === 'compat') {
    if (!compatWarned) {
      compatWarned = true;
      console.warn('[uploadAuth] UPLOAD_AUTH_MODE=compat：/uploads 暂未强制鉴权，请在 APK 铺开后切 strict');
    }
    return next();
  }
  const header = req.headers['authorization'];
  let token = null;
  if (header && header.startsWith('Bearer ')) token = header.slice(7).trim();
  if (!token && typeof req.query.token === 'string' && req.query.token) token = req.query.token;
  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌', code: 'UNAUTHORIZED' });
  }
  return jwt.verify(token, env.JWT_SECRET, (err) => {
    if (err) {
      return res.status(403).json({ success: false, error: '无效的认证令牌', code: 'FORBIDDEN' });
    }
    return next();
  });
}

module.exports = requireUploadAccess;
