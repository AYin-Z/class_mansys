const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticateToken } = require('../middleware/auth');

// 登录
router.post('/login', AuthController.login);

// CloudBase UID 登录（H5/Web/非微信端）
router.post('/cloudbase-login', AuthController.cloudBaseLogin);

// 注册
router.post('/register', AuthController.register);

// 刷新令牌
router.post('/refresh', AuthController.refreshToken);

// 登出
router.post('/logout', authenticateToken, AuthController.logout);

// 获取用户信息
router.get('/userinfo', authenticateToken, AuthController.getUserInfo);

// 按学号查找用户（受认证保护）
router.post('/find-by-student', authenticateToken, AuthController.findByStudent);

module.exports = router;