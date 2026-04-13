const express = require('express');
const router = express.Router();
const NoticeController = require('../controllers/NoticeController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// 发布通知
router.post('/create', authenticateToken, authorizeAdmin, NoticeController.createNotice);

// 获取通知列表
router.get('/', authenticateToken, NoticeController.getNotices);

// 获取通知详情
router.get('/:id', authenticateToken, NoticeController.getNoticeDetail);

// 获取未读通知数
router.get('/unread/count', authenticateToken, NoticeController.getUnreadCount);

module.exports = router;