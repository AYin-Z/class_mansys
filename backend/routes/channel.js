const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, ok, NotFoundError } = require('../shared/http');
const { requirePermission } = require('../shared/permissions');
const ChannelService = require('../services/channel/channelService');
const BotLogin = require('../services/channel/botLogin');

// ---- 微信机器人身份登录（超管扫码；把 CLI 流程搬到站内） ----
router.get('/bot-login', authenticateToken, requirePermission('MANAGE_CHANNEL'), asyncHandler(async (req, res) => {
  const worker = await BotLogin.constructor.workerState();
  return ok(res, Object.assign({ worker }, BotLogin.connection()));
}));

router.post('/bot-login/start', authenticateToken, requirePermission('MANAGE_CHANNEL'), asyncHandler(async (req, res) => {
  const result = await BotLogin.start();
  return ok(res, result);
}));

router.get('/bot-login/status', authenticateToken, requirePermission('MANAGE_CHANNEL'), asyncHandler(async (req, res) => {
  const result = await BotLogin.status();
  return ok(res, result);
}));

// 生成微信绑定码（15 分钟有效，一次性）
router.post('/bind-code', authenticateToken, asyncHandler(async (req, res) => {
  const result = await ChannelService.issueBindCode(req.user);
  return ok(res, result);
}));

// 我的绑定列表
router.get('/bindings', authenticateToken, asyncHandler(async (req, res) => {
  const bindings = await ChannelService.listBindings(req.user.id);
  return ok(res, undefined, { bindings });
}));

// 解绑
router.delete('/bindings/:id', authenticateToken, asyncHandler(async (req, res) => {
  const okDone = await ChannelService.unbindById(req.user.id, Number(req.params.id));
  if (!okDone) throw new NotFoundError('绑定不存在');
  return ok(res, undefined, { message: '已解绑' });
}));

module.exports = router;
