const express = require('express');
const router = express.Router();
const LotteryController = require('../controllers/LotteryController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

router.get('/', authenticateToken, LotteryController.list);
router.post('/', authenticateToken, requirePermission('CREATE_LOTTERY'), validateBody(schemas.lotteryCreate), LotteryController.create);
router.get('/:id', authenticateToken, LotteryController.detail);
router.post('/:id/join', authenticateToken, LotteryController.join);
router.post('/:id/draw', authenticateToken, requirePermission('DRAW_LOTTERY'), LotteryController.draw);
router.put('/:id/close', authenticateToken, requirePermission('DRAW_LOTTERY'), LotteryController.close);

module.exports = router;
