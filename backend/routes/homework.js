const express = require('express');
const router = express.Router();
const HomeworkController = require('../controllers/HomeworkController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, HomeworkController.list);
router.post('/', authenticateToken, HomeworkController.create);
router.get('/:id', authenticateToken, HomeworkController.detail);
router.delete('/:id', authenticateToken, HomeworkController.remove);
router.post('/:id/submit', authenticateToken, HomeworkController.submit);
router.put('/submission/:submissionId/grade', authenticateToken, HomeworkController.grade);

module.exports = router;
