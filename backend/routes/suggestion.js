const express = require('express');
const router = express.Router();
const SuggestionController = require('../controllers/SuggestionController');
const { authenticateToken } = require('../middleware/auth');

// 提交建议（匿名，但仍需登录以防止滥用）
router.post('/', authenticateToken, SuggestionController.submit);

// 管理员：全部
router.get('/', authenticateToken, SuggestionController.listAll);

// 用户：通过本地存的 id 列表反查我的提交
router.get('/mine', authenticateToken, SuggestionController.listMine);

router.get('/:id', authenticateToken, SuggestionController.getDetail);

// 管理员：处理
router.post('/:id/handle', authenticateToken, SuggestionController.handle);

module.exports = router;
