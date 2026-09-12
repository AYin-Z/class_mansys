const jwt = require('jsonwebtoken');
const { isAdmin, hasRole } = require('../shared/constants');
const { env } = require('../config/env');
const { checkTokenVersion } = require('../shared/tokenVersion');

/**
 * 认证中间件（P2-2：会话可吊销）
 *
 * 校验顺序：
 *   1) 有令牌吗？没 → 401
 *   2) 签名/有效期对吗？不对 → 403
 *   3) 令牌代次（tv）与库里的 users.token_version 一致吗？不一致 → 401「登录状态已失效，请重新登录」
 *
 * 关于第 3 步：
 *   - 老令牌没有 tv → 视为 0（迁移上线后不会把人立刻踢下线）；
 *   - 比对走进程内缓存（60s TTL，见 shared/tokenVersion.js），不是一个请求一次查询；
 *   - 数据库读取失败时降级放行并告警（可用性优先，避免一次抖动打掉全部在线用户）。
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(403).json({ success: false, error: '无效的认证令牌' });
  }

  return checkTokenVersion(payload)
    .then((result) => {
      if (!result.ok) {
        // user-missing（用户已被删除）与 tv-mismatch（改密/重置/移出）对客户端是同一件事：重新登录
        return res.status(401).json({
          success: false,
          error: '登录状态已失效，请重新登录',
          code: 'TOKEN_REVOKED'
        });
      }
      req.user = payload;
      return next();
    })
    .catch((err) => next(err));
}

function authorizeAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: '需要管理员权限' });
  }
  next();
}

function authorizeRole(requiredRole) {
  return (req, res, next) => {
    if (!hasRole(req.user, requiredRole)) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeAdmin,
  authorizeRole
};
