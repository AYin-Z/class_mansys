const express = require('express');
const router = express.Router();
const LotteryController = require('../controllers/LotteryController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, LotteryController.list);
router.post('/', authenticateToken, LotteryController.create);
router.get('/:id', authenticateToken, LotteryController.detail);
router.post('/:id/join', authenticateToken, LotteryController.join);
router.post('/:id/draw', authenticateToken, LotteryController.draw);
router.put('/:id/close', authenticateToken, LotteryController.close);

module.exports = router;
