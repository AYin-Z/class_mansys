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

// --- 新增认证方式 ---

// 学号+密码登录
router.post('/login-with-password', AuthController.loginWithPassword);

// 手机号+密码登录
router.post('/login-with-phone', AuthController.loginWithPhone);

// 发送验证码（手机号/邮箱）
router.post('/send-code', AuthController.sendCode);

// 手机号+验证码登录/注册
router.post('/phone-code-login', AuthController.phoneCodeLogin);

// 邮箱+验证码登录
router.post('/email-code-login', AuthController.emailCodeLogin);

// 设置/重置密码
router.post('/set-password', AuthController.setPassword);

// 已登录用户修改密码
router.post('/change-password', authenticateToken, AuthController.changePassword);

module.exports = router;