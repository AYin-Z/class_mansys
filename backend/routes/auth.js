const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticateToken } = require('../middleware/auth');

// 登录
router.post('/login', AuthController.login);

// 注册
router.post('/register', AuthController.register);

// 刷新令牌
router.post('/refresh', AuthController.refreshToken);

// 登出
router.post('/logout', authenticateToken, AuthController.logout);

// 获取用户信息
router.get('/userinfo', authenticateToken, AuthController.getUserInfo);

module.exports = router;