const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

// 成员名册与操作记录（仅本区队，控制器内做作用域过滤）
router.get('/members', authenticateToken, requirePermission('VIEW_ROSTER'), AdminController.listMembers);
router.get('/members/:id', authenticateToken, requirePermission('VIEW_ROSTER'), AdminController.memberDetail);
router.get('/operations', authenticateToken, requirePermission('VIEW_ROSTER'), AdminController.recentOperations);

// 修改成员角色（仅超级管理员）
router.put('/members/:id/role', authenticateToken, requirePermission('MANAGE_MEMBER_ROLE'), AdminController.updateMemberRole);

// 请假类型配置（仅超级管理员）
router.get('/leave-config', authenticateToken, requirePermission('MANAGE_LEAVE_CONFIG'), AdminController.getLeaveConfig);
router.put('/leave-config/:id', authenticateToken, requirePermission('MANAGE_LEAVE_CONFIG'), validateBody(schemas.leaveConfigUpdate), AdminController.updateLeaveConfig);

module.exports = router;
