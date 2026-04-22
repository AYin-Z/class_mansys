const express = require('express');
const router = express.Router();
const ClassController = require('../controllers/ClassController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', ClassController.list);
router.post('/', authenticateToken, ClassController.create);

module.exports = router;
