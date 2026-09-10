const express = require('express');
const router = express.Router();
const NoticeController = require('../controllers/NoticeController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

router.post('/create', authenticateToken, requirePermission('PUBLISH_NOTICE'), validateBody(schemas.noticeCreate), NoticeController.createNotice);
router.get('/', authenticateToken, NoticeController.getNotices);
// 固定路径必须放在 /:id 之前
router.get('/unread/count', authenticateToken, NoticeController.getUnreadCount);
router.get('/todo/count', authenticateToken, NoticeController.getTodoCount);
router.post('/:id/complete', authenticateToken, NoticeController.completeTodo);
router.get('/:id/completion', authenticateToken, requirePermission('VIEW_ROSTER'), NoticeController.getTodoCompletion);
router.get('/:id', authenticateToken, NoticeController.getNoticeDetail);
router.put('/:id', authenticateToken, requirePermission('MANAGE_NOTICE'), NoticeController.updateNotice);
router.delete('/:id', authenticateToken, requirePermission('MANAGE_NOTICE'), NoticeController.deleteNotice);

module.exports = router;
