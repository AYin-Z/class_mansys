const express = require('express');
const router = express.Router();
const AnnouncementController = require('../controllers/AnnouncementController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { uploadResource } = require('../config/multer');

// 公告
router.get('/', authenticateToken, AnnouncementController.listAnnouncements);
router.post('/create', authenticateToken, requirePermission('PUBLISH_ANNOUNCEMENT'), validateBody(schemas.announcementCreate), AnnouncementController.createAnnouncement);
router.get('/resources', authenticateToken, AnnouncementController.listResources);
router.post('/resources/upload', authenticateToken, requirePermission('UPLOAD_RESOURCE'), uploadResource.single('file'), AnnouncementController.uploadResource);
router.delete('/resources/:id', authenticateToken, requirePermission('MANAGE_ANNOUNCEMENT'), AnnouncementController.deleteResource);
// 修订历史与回退（P3-4）：权限在控制器内判定（超管 / 发布者本人）
router.get('/:id/revisions', authenticateToken, requirePermission('PUBLISH_ANNOUNCEMENT'), AnnouncementController.listAnnouncementRevisions);
router.get('/:id/revisions/:version', authenticateToken, requirePermission('PUBLISH_ANNOUNCEMENT'), AnnouncementController.getAnnouncementRevision);
router.post('/:id/revert/:version', authenticateToken, requirePermission('PUBLISH_ANNOUNCEMENT'), AnnouncementController.revertAnnouncement);
router.put('/:id', authenticateToken, requirePermission('PUBLISH_ANNOUNCEMENT'), AnnouncementController.updateAnnouncement);

router.get('/:id', authenticateToken, AnnouncementController.getAnnouncementDetail);
router.delete('/:id', authenticateToken, requirePermission('MANAGE_ANNOUNCEMENT'), AnnouncementController.deleteAnnouncement);

module.exports = router;
