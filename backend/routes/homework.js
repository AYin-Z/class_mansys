const express = require('express');
const router = express.Router();
const HomeworkController = require('../controllers/HomeworkController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

router.get('/pending/count', authenticateToken, HomeworkController.pendingCount);
router.get('/', authenticateToken, HomeworkController.list);
router.post('/', authenticateToken, authorizeAdmin, HomeworkController.create);
router.get('/:id', authenticateToken, HomeworkController.detail);
router.post('/:id/submit', authenticateToken, HomeworkController.submit);
router.put('/submission/:submissionId/grade', authenticateToken, authorizeAdmin, HomeworkController.grade);
router.delete('/:id', authenticateToken, authorizeAdmin, HomeworkController.remove);

module.exports = router;
