const express = require('express');
const router = express.Router();
const AlbumController = require('../controllers/AlbumController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { uploadPhoto } = require('../config/multer');

router.get('/', authenticateToken, AlbumController.listAlbums);
router.post('/', authenticateToken, requirePermission('MANAGE_ALBUM'), validateBody(schemas.albumCreate), AlbumController.createAlbum);

router.post('/photos', authenticateToken, AlbumController.uploadPhotos);
router.post('/photos/upload', authenticateToken, uploadPhoto.single('file'), AlbumController.uploadPhotoFile);
router.get('/photos/pending', authenticateToken, requirePermission('APPROVE_PHOTO'), AlbumController.getPendingPhotos);
router.post('/photos/:id/approve', authenticateToken, requirePermission('APPROVE_PHOTO'), AlbumController.approvePhoto);
// 删除照片：待审核=驳回（需 APPROVE_PHOTO）、已通过=本相册创建者或上传者本人也可删，
// 权限判断在控制器内完成（见 AlbumController.rejectPhoto）
router.delete('/photos/:id', authenticateToken, AlbumController.rejectPhoto);

router.get('/:id', authenticateToken, AlbumController.getAlbumDetail);
router.delete('/:id', authenticateToken, requirePermission('MANAGE_ALBUM'), AlbumController.deleteAlbum);

module.exports = router;
