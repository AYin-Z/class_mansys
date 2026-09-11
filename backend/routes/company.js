const express = require('express');
const router = express.Router();
const CompanyController = require('../controllers/CompanyController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');

// 中队（公司）级聚合：权限由权限矩阵的 VIEW_COMPANY 决定（后台可配置），
// 控制器内再做区队/中队作用域过滤（能看范围 ≠ 能看明细）。
router.get('/overview', authenticateToken, requirePermission('VIEW_COMPANY'), CompanyController.overview);
router.get('/classes', authenticateToken, requirePermission('VIEW_COMPANY'), CompanyController.classes);
router.get('/leave-records', authenticateToken, requirePermission('VIEW_COMPANY'), CompanyController.leaveRecords);

module.exports = router;
