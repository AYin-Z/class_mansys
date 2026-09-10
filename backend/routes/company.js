const express = require('express');
const router = express.Router();
const CompanyController = require('../controllers/CompanyController');
const { authenticateToken } = require('../middleware/auth');

// 中队（公司）级聚合：仅具备 hasCompanyView（区队管理层平行权限）可访问，控制器内二次校验
router.get('/overview', authenticateToken, CompanyController.overview);
router.get('/classes', authenticateToken, CompanyController.classes);
router.get('/leave-records', authenticateToken, CompanyController.leaveRecords);

module.exports = router;
