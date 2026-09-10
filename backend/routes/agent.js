const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { asyncHandler, ok } = require('../shared/http');
const AgentService = require('../services/agent/agentService');

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

// 能力目录（前端可用于展示“我能问什么”）
router.get('/tools', authenticateToken, asyncHandler(async (req, res) => ok(res, AgentService.toolsInfo(req.app))));

router.get('/conversations', authenticateToken, asyncHandler(async (req, res) => {
  const conversations = await AgentService.listConversations(req.user);
  return ok(res, undefined, { conversations });
}));

router.get('/conversations/:id/messages', authenticateToken, asyncHandler(async (req, res) => {
  const messages = await AgentService.listMessages(req.user, req.params.id);
  return ok(res, undefined, { messages });
}));

// 对话（读操作立即执行；写操作返回待确认动作）
router.post('/chat', authenticateToken, validateBody(schemas.agentChat), asyncHandler(async (req, res) => {
  const result = await AgentService.chat(
    req.user,
    bearer(req),
    { conversationId: req.body.conversationId, message: req.body.message },
    req.app
  );
  return res.json({ success: true, ...result });
}));

// 对话（SSE 流式：delta / tool / pending / error 事件）
router.post('/chat/stream', authenticateToken, validateBody(schemas.agentChat), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  const send = (event) => { try { res.write('data: ' + JSON.stringify(event) + '\n\n'); } catch (e) { /* client gone */ } };
  try {
    const result = await AgentService.chatStream(
      req.user,
      bearer(req),
      { conversationId: req.body.conversationId, message: req.body.message },
      req.app,
      send
    );
    send({ type: 'done', conversationId: result.conversationId, reply: result.reply, pendingAction: result.pendingAction || null });
  } catch (e) {
    send({ type: 'error', message: e.message || '助手暂时不可用' });
  } finally {
    res.end();
  }
});

// 确认并执行待确认动作
router.post('/confirm', authenticateToken, validateBody(schemas.agentConfirm), asyncHandler(async (req, res) => {
  const result = await AgentService.confirm(req.user, bearer(req), req.body.actionId, req.app);
  return res.json({ success: true, ...result });
}));

module.exports = router;
