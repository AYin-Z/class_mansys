const express = require('express');
const router = express.Router();
const NoticeController = require('../controllers/NoticeController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

router.post('/create', authenticateToken, authorizeAdmin, NoticeController.createNotice);
router.get('/', authenticateToken, NoticeController.getNotices);
// 注意：固定路径必须放在 /:id 之前
router.get('/unread/count', authenticateToken, NoticeController.getUnreadCount);
router.get('/:id', authenticateToken, NoticeController.getNoticeDetail);
router.put('/:id', authenticateToken, authorizeAdmin, NoticeController.updateNotice);
router.delete('/:id', authenticateToken, authorizeAdmin, NoticeController.deleteNotice);

module.exports = router;
