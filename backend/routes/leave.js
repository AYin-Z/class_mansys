const express = require('express');
const router = express.Router();
const LeaveController = require('../controllers/LeaveController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { uploadLeaveProof } = require('../config/multer');

// 获取启用的请假类型配置
router.get('/types', authenticateToken, LeaveController.getLeaveTypes);

// 上传请假证明材料
router.post('/upload-proof', authenticateToken, uploadLeaveProof.single('file'), LeaveController.uploadProof);

// 提交请假申请
router.post('/apply', authenticateToken, validateBody(schemas.leaveApply), LeaveController.applyLeave);

// 获取我的请假记录
router.get('/my', authenticateToken, LeaveController.getMyLeaves);

// 获取所有请假记录（管理员）
router.get('/all', authenticateToken, requirePermission('VIEW_ROSTER'), LeaveController.getAllLeaves);

// 单条请假详情（本人或管理员）
router.get('/:id', authenticateToken, LeaveController.getLeaveById);

// 审批请假
// 审批改为走权限矩阵（APPROVE_LEAVE），并补上唯一缺失的入参校验
router.put('/approve', authenticateToken, requirePermission('APPROVE_LEAVE'), validateBody(schemas.leaveApprove), LeaveController.approveLeave);

// 销假
router.put('/cancel/:id', authenticateToken, LeaveController.cancelLeave);

module.exports = router;