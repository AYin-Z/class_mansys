const express = require('express');
const router = express.Router();
const PointsController = require('../controllers/PointsController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

router.get('/mine', authenticateToken, PointsController.listMine);
router.get('/ranking', authenticateToken, PointsController.ranking);
router.get('/all', authenticateToken, requirePermission('MANAGE_POINTS'), PointsController.listAll);
router.post('/', authenticateToken, requirePermission('MANAGE_POINTS'), validateBody(schemas.pointsAdd), PointsController.addRecord);
router.delete('/:id', authenticateToken, requirePermission('MANAGE_POINTS'), PointsController.deleteRecord);

module.exports = router;
