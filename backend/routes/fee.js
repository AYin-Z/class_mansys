const express = require('express');
const router = express.Router();
const FeeController = require('../controllers/FeeController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// === 收缴 ===
router.post('/collections', authenticateToken, FeeController.createCollection);
router.get('/collections', authenticateToken, FeeController.listCollections);
router.get('/collections/:id', authenticateToken, FeeController.getCollectionDetail);
router.get('/collections/:id/records', authenticateToken, FeeController.getCollectionRecords);
router.post('/collections/:id/pay', authenticateToken, FeeController.payCollection);
router.post('/collections/:id/exempt', authenticateToken, FeeController.exemptCollection);
router.post('/collections/:id/close', authenticateToken, FeeController.closeCollection);

// === 申请 (expenses) ===
router.post('/expenses', authenticateToken, FeeController.createExpense);
router.get('/expenses/my', authenticateToken, FeeController.getMyExpenses);
router.get('/expenses', authenticateToken, FeeController.getAllExpenses);
router.get('/expenses/:id', authenticateToken, FeeController.getExpenseDetail);

// === 审批 ===
router.get('/approvals/pending', authenticateToken, FeeController.getPendingApprovals);
router.post('/approvals/:id', authenticateToken, FeeController.approveExpense);
router.post('/approvals/:id/reject', authenticateToken, FeeController.rejectExpense);
router.post('/approvals/:id/vote', authenticateToken, FeeController.castVote);
router.get('/approvals/:id/votes', authenticateToken, FeeController.getVoteResult);

// === 公示 ===
router.post('/publications', authenticateToken, FeeController.createPublication);
router.get('/publications', authenticateToken, FeeController.listPublications);
router.get('/publications/:id', authenticateToken, FeeController.getPublicationDetail);

// === 汇总 ===
router.get('/summary', authenticateToken, FeeController.getSummary);

// === 兼容老端点（供已有前端页面使用）===
router.post('/expense', authenticateToken, FeeController.createExpense);
router.get('/my', authenticateToken, FeeController.getMyExpenses);
router.get('/all', authenticateToken, FeeController.getAllExpenses);
router.put('/approve', authenticateToken, FeeController.approveExpense);
router.get('/balance', authenticateToken, FeeController.getBalance);

module.exports = router;
