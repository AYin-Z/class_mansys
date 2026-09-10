const express = require('express');
const router = express.Router();
const SuggestionController = require('../controllers/SuggestionController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');

// 提交建议（匿名，但仍需登录以防止滥用）
router.post('/', authenticateToken, validateBody(schemas.suggestionSubmit), SuggestionController.submit);

// 我的提交（凭 view_token 反查）
router.get('/mine', authenticateToken, SuggestionController.listMine);

// 管理员：全部 / 详情 / 处理
router.get('/', authenticateToken, requirePermission('HANDLE_SUGGESTION'), SuggestionController.listAll);
router.get('/:id', authenticateToken, requirePermission('HANDLE_SUGGESTION'), SuggestionController.getDetail);
router.post('/:id/handle', authenticateToken, requirePermission('HANDLE_SUGGESTION'), SuggestionController.handle);

module.exports = router;
