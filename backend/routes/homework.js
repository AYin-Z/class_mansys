const express = require('express');
const router = express.Router();
const HomeworkController = require('../controllers/HomeworkController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

router.get('/pending/count', authenticateToken, HomeworkController.pendingCount);
router.get('/', authenticateToken, HomeworkController.list);
router.post('/', authenticateToken, requirePermission('PUBLISH_HOMEWORK'), validateBody(schemas.homeworkCreate), HomeworkController.create);
router.get('/:id', authenticateToken, HomeworkController.detail);
router.post('/:id/submit', authenticateToken, HomeworkController.submit);
router.put('/submission/:submissionId/grade', authenticateToken, requirePermission('GRADE_HOMEWORK'), HomeworkController.grade);
router.delete('/:id', authenticateToken, requirePermission('PUBLISH_HOMEWORK'), HomeworkController.remove);

module.exports = router;
