const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// 管理员成员列表
router.get('/members', authenticateToken, authorizeAdmin, AdminController.listMembers);

// 管理员成员详情（含请假状态、近期操作）
router.get('/members/:id', authenticateToken, authorizeAdmin, AdminController.memberDetail);

// 近期操作（全系统 / 按班级）
router.get('/operations', authenticateToken, authorizeAdmin, AdminController.recentOperations);

module.exports = router;
