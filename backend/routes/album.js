const express = require('express');
const router = express.Router();
const AlbumController = require('../controllers/AlbumController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, AlbumController.listAlbums);
router.post('/', authenticateToken, authorizeAdmin, AlbumController.createAlbum);

router.post('/photos', authenticateToken, AlbumController.uploadPhotos);
router.get('/photos/pending', authenticateToken, AlbumController.getPendingPhotos);
router.post('/photos/:id/approve', authenticateToken, AlbumController.approvePhoto);
router.delete('/photos/:id', authenticateToken, AlbumController.rejectPhoto);

router.get('/:id', authenticateToken, AlbumController.getAlbumDetail);
router.delete('/:id', authenticateToken, AlbumController.deleteAlbum);

module.exports = router;
