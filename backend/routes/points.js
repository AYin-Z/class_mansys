const express = require('express');
const router = express.Router();
const PointsController = require('../controllers/PointsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/mine', authenticateToken, PointsController.listMine);
router.get('/ranking', authenticateToken, PointsController.ranking);
router.get('/all', authenticateToken, PointsController.listAll);
router.post('/', authenticateToken, PointsController.addRecord);

module.exports = router;
