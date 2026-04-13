const express = require('express');
const router = express.Router();
const FeeController = require('../controllers/FeeController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// 提交班费记录
router.post('/expense', authenticateToken, FeeController.createExpense);

// 获取我的班费记录
router.get('/my', authenticateToken, FeeController.getMyExpenses);

// 获取所有班费记录（管理员）
router.get('/all', authenticateToken, authorizeAdmin, FeeController.getAllExpenses);

// 审批班费记录
router.put('/approve', authenticateToken, authorizeAdmin, FeeController.approveExpense);

// 获取班费余额
router.get('/balance', authenticateToken, FeeController.getBalance);

module.exports = router;