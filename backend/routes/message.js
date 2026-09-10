const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');
const { authenticateToken } = require('../middleware/auth');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

router.get('/', authenticateToken, MessageController.list);
router.post('/', authenticateToken, validateBody(schemas.messageCreate), MessageController.create);
router.delete('/:id', authenticateToken, MessageController.remove);

module.exports = router;
