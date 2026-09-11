const express = require('express');
const router = express.Router();
const FeeController = require('../controllers/FeeController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { uploadResource } = require('../config/multer');

// === 收缴 ===
router.post('/collections', authenticateToken, requirePermission('COLLECT_FEE'), validateBody(schemas.feeCreateCollection), FeeController.createCollection);
router.get('/collections', authenticateToken, FeeController.listCollections);
router.get('/collections/:id', authenticateToken, FeeController.getCollectionDetail);
router.get('/collections/:id/records', authenticateToken, requirePermission('VIEW_ROSTER'), FeeController.getCollectionRecords);
router.post('/collections/:id/pay', authenticateToken, validateBody(schemas.feePay), FeeController.payCollection);
router.post('/collections/:id/exempt', authenticateToken, requirePermission('COLLECT_FEE'), FeeController.exemptCollection);
router.post('/collections/:id/close', authenticateToken, requirePermission('COLLECT_FEE'), FeeController.closeCollection);

// === 申请 (expenses) ===
router.post('/expenses', authenticateToken, validateBody(schemas.feeCreateExpense), FeeController.createExpense);
router.get('/expenses/my', authenticateToken, FeeController.getMyExpenses);
router.get('/expenses', authenticateToken, requirePermission('VIEW_ROSTER'), FeeController.getAllExpenses);
router.get('/expenses/:id', authenticateToken, FeeController.getExpenseDetail);

// === 审批 ===
// 待审批/待投票列表：干部看到自己该审的步骤，学员看到 step=3 的匿名投票项（PRD：全班投票）
router.get('/approvals/pending', authenticateToken, FeeController.getPendingApprovals);
router.post('/approvals/:id', authenticateToken, requirePermission('APPROVE_FEE_USE'), FeeController.approveExpense);
router.post('/approvals/:id/reject', authenticateToken, requirePermission('APPROVE_FEE_USE'), FeeController.rejectExpense);
router.post('/approvals/:id/vote', authenticateToken, FeeController.castVote);
router.get('/approvals/:id/votes', authenticateToken, FeeController.getVoteResult);

// === 公示 ===
router.post('/publications', authenticateToken, requirePermission('BOOKKEEP_FEE'), validateBody(schemas.feePublicationCreate), FeeController.createPublication);
router.get('/publications', authenticateToken, FeeController.listPublications);
router.get('/publications/:id', authenticateToken, FeeController.getPublicationDetail);

// === 汇总 ===
router.get('/summary', authenticateToken, FeeController.getSummary);

// === 证明材料上传 ===
router.post('/proof/upload', authenticateToken, uploadResource.single('file'), FeeController.uploadProof);

module.exports = router;
