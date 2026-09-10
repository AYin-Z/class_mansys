const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { asyncHandler, ok, NotFoundError } = require('../shared/http');
const { ApiTokenService } = require('../services/apiToken');

// 创建个人访问令牌（供 MCP / 外部 agent 使用；明文只返回一次）
router.post('/', authenticateToken, validateBody(schemas.apiTokenCreate), asyncHandler(async (req, res) => {
  const created = await ApiTokenService.create(req.user.id, req.body.name, !!req.body.allowWrite);
  return ok(res, created, { message: '请立即保存该令牌，之后无法再次查看' });
}));

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const tokens = await ApiTokenService.list(req.user.id);
  return ok(res, undefined, { tokens });
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const revoked = await ApiTokenService.revoke(req.user.id, Number(req.params.id));
  if (!revoked) throw new NotFoundError('令牌不存在');
  return ok(res, undefined, { message: '已吊销' });
}));

module.exports = router;
