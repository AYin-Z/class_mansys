const express = require('express');
const router = express.Router();
const AnnouncementController = require('../controllers/AnnouncementController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { uploadResource } = require('../config/multer');

// 公告
router.get('/', authenticateToken, AnnouncementController.listAnnouncements);
router.post('/create', authenticateToken, authorizeAdmin, AnnouncementController.createAnnouncement);
router.get('/resources', authenticateToken, AnnouncementController.listResources);
router.post('/resources', authenticateToken, authorizeAdmin, AnnouncementController.createResource);
router.post('/resources/upload', authenticateToken, authorizeAdmin, uploadResource.single('file'), AnnouncementController.uploadResource);
router.delete('/resources/:id', authenticateToken, authorizeAdmin, AnnouncementController.deleteResource);
router.get('/:id', authenticateToken, AnnouncementController.getAnnouncementDetail);
router.delete('/:id', authenticateToken, authorizeAdmin, AnnouncementController.deleteAnnouncement);

module.exports = router;
