const express = require('express');
const router = express.Router();
const LeaveController = require('../controllers/LeaveController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// 提交请假申请
router.post('/apply', authenticateToken, LeaveController.applyLeave);

// 获取我的请假记录
router.get('/my', authenticateToken, LeaveController.getMyLeaves);

// 获取所有请假记录（管理员）
router.get('/all', authenticateToken, authorizeAdmin, LeaveController.getAllLeaves);

// 审批请假
router.put('/approve', authenticateToken, authorizeAdmin, LeaveController.approveLeave);

// 销假
router.put('/cancel/:id', authenticateToken, LeaveController.cancelLeave);

module.exports = router;