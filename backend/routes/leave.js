const express = require('express');
const router = express.Router();
const LeaveController = require('../controllers/LeaveController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
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
router.get('/all', authenticateToken, authorizeAdmin, LeaveController.getAllLeaves);

// 单条请假详情（本人或管理员）
router.get('/:id', authenticateToken, LeaveController.getLeaveById);

// 审批请假
router.put('/approve', authenticateToken, authorizeAdmin, LeaveController.approveLeave);

// 销假
router.put('/cancel/:id', authenticateToken, LeaveController.cancelLeave);

module.exports = router;