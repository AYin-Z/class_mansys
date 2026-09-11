const express = require('express');
const router = express.Router();
const HomeworkController = require('../controllers/HomeworkController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { uploadResource } = require('../config/multer');

router.get('/pending/count', authenticateToken, HomeworkController.pendingCount);
// 作业附件上传（支持 docx/pdf/图片/zip ≤100MB）：此前前端只能用"粘贴网盘链接"凑合，
// 复用 /api/fee/proof/upload 属越界借用，这里给出作业自己的端点。
router.post('/upload', authenticateToken, uploadResource.single('file'), HomeworkController.uploadAttachment);
router.get('/', authenticateToken, HomeworkController.list);
router.post('/', authenticateToken, requirePermission('PUBLISH_HOMEWORK'), validateBody(schemas.homeworkCreate), HomeworkController.create);
router.get('/:id', authenticateToken, HomeworkController.detail);
router.post('/:id/submit', authenticateToken, HomeworkController.submit);
router.put('/submission/:submissionId/grade', authenticateToken, requirePermission('GRADE_HOMEWORK'), HomeworkController.grade);
router.delete('/:id', authenticateToken, requirePermission('PUBLISH_HOMEWORK'), HomeworkController.remove);

module.exports = router;
