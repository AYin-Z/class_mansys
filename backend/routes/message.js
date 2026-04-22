const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, MessageController.list);
router.post('/', authenticateToken, MessageController.create);
router.delete('/:id', authenticateToken, MessageController.remove);

module.exports = router;
