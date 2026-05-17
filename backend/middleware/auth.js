const jwt = require('jsonwebtoken');
const { isAdmin, hasRole } = require('../shared/constants');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '无效的认证令牌' });
    }
    req.user = user;
    next();
  });
}

function authorizeAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

function authorizeRole(requiredRole) {
  return (req, res, next) => {
    if (!hasRole(req.user, requiredRole)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeAdmin,
  authorizeRole
};