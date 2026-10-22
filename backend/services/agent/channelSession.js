/**
 * 渠道会话指针（微信等外部渠道 → 站内 agent_conversations）
 *
 * 旧实现里 ChannelService 每次调用 AgentService.chat 都不传 conversationId，
 * agentService 于是「缺 ID 就新建会话」——用户发 5 条消息得到 5 个互不相干的会话，
 * 图片、草稿、确认状态全部丢失。这个模块把「谁在哪个渠道的哪条身份」映射到一条站内会话：
 *
 *   (channel, external_id) ──> conversation_id，带状态与过期时间
 *
 * 过期规则（双闸）：
 *   - 空闲 12h：最后一条消息（updated_at）距今超过 12h
 *   - 绝对 7d：从本次会话建立（expires_at = 建立时 + 7d）起算
 * 任一触发就关闭旧会话、建新会话；/新会话 | /新对话 | /reset 显式轮换。
 * 绑定/解绑也会关闭指针，避免换绑后继续用上一个人的会话。
 */
const AgentRepo = require('./repo');
const logger = require('../../config/logger');

const IDLE_MS = 12 * 60 * 60 * 1000;
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_RE = /^[/／](?:新会话|新对话|reset)$/i;

function isResetCommand(text) {
  return RESET_RE.test(String(text || '').trim());
}

function titleOf(text) {
  return String(text || '对话').replace(/\s+/g, ' ').trim().slice(0, 40) || '对话';
}

function expiredNow(row, nowMs) {
  if (!row) return true;
  if (row.status !== 'active') return true;
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const touched = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  if (!expires || expires <= nowMs) return true;
  if (touched && nowMs - touched > IDLE_MS) return true;
  return false;
}

/**
 * 取得/轮换渠道会话。
 * @returns {Promise<{conversationId:number, isNew:boolean, rotated:boolean, reason:string|null, session:object}>}
 */
async function resolveSession({ channel, externalId, userId, title, reset, now } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const existing = await AgentRepo.findChannelSession(channel, externalId);
  let reason = null;
  if (reset) reason = 'reset';
  else if (!existing) reason = 'new';
  else if (Number(existing.user_id) !== Number(userId)) reason = 'user_changed';
  else if (expiredNow(existing, nowMs)) reason = 'expired';

  if (!reason) {
    await AgentRepo.touchChannelSession(existing.id);
    return {
      conversationId: Number(existing.conversation_id),
      isNew: false,
      rotated: false,
      reason: null,
      session: existing
    };
  }

  const conversationId = await AgentRepo.createConversation(userId, titleOf(title));
  const expiresAt = new Date(nowMs + ABSOLUTE_MS);

  if (existing) {
    // 换绑时旧会话属于旧用户：closeConversation 带 userId 只会关掉他自己的会话
    await AgentRepo.closeConversation(existing.conversation_id, existing.user_id);
    await AgentRepo.updateChannelSession(existing.id, {
      userId,
      conversationId,
      expiresAt,
      status: 'active'
    });
  } else {
    await AgentRepo.createChannelSession({ channel, externalId, userId, conversationId, expiresAt });
  }

  if (reason !== 'new') {
    logger.info(
      { event: 'session_rotated', channel, userId, reason, oldConversationId: existing ? Number(existing.conversation_id) : null, conversationId },
      'agent channel session rotated'
    );
  }

  return {
    conversationId,
    isNew: true,
    rotated: !!existing,
    reason,
    session: await AgentRepo.findChannelSession(channel, externalId)
  };
}

/** 绑定/解绑时关闭渠道会话（旧会话 closed_at 落库，历史仍可读） */
async function closeSession({ channel, externalId, status = 'closed' } = {}) {
  const existing = await AgentRepo.findChannelSession(channel, externalId);
  if (!existing) return false;
  if (existing.conversation_id) await AgentRepo.closeConversation(existing.conversation_id, existing.user_id);
  return AgentRepo.closeChannelSession(channel, externalId, status);
}

/** 仅关闭指针，不关闭站内会话（保留现场，供排查/续接） */
async function detachSession({ channel, externalId, status = 'closed' } = {}) {
  return AgentRepo.closeChannelSession(channel, externalId, status);
}

module.exports = {
  resolveSession,
  closeSession,
  detachSession,
  isResetCommand,
  expiredNow,
  IDLE_MS,
  ABSOLUTE_MS,
  RESET_RE
};
