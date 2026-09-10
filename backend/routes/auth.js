const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticateToken } = require('../middleware/auth');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

// 登录
router.post('/login', AuthController.login);

// CloudBase UID 登录（H5/Web/非微信端）
router.post('/cloudbase-login', AuthController.cloudBaseLogin);

// 注册
router.post('/register', validateBody(schemas.register), AuthController.register);

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
router.post('/login-with-password', validateBody(schemas.loginWithPassword), AuthController.loginWithPassword);

// 手机号+密码登录
router.post('/login-with-phone', validateBody(schemas.loginWithPhone), AuthController.loginWithPhone);
router.post('/login-with-email', validateBody(schemas.loginWithEmail), AuthController.loginWithEmail);

// 发送验证码（手机号/邮箱）
router.post('/send-code', validateBody(schemas.sendCode), AuthController.sendCode);

// 手机号+验证码登录/注册
router.post('/phone-code-login', validateBody(schemas.phoneCodeLogin), AuthController.phoneCodeLogin);

// 邮箱+验证码登录
router.post('/email-code-login', validateBody(schemas.emailCodeLogin), AuthController.emailCodeLogin);

// 设置/重置密码
router.post('/set-password', validateBody(schemas.setPassword), AuthController.setPassword);

// 已登录用户修改密码
router.post('/change-password', authenticateToken, AuthController.changePassword);

module.exports = router;