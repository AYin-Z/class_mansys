const crypto = require('crypto');
const ChannelRepo = require('./channelRepo');
const User = require('../../models/User');
const AgentService = require('../agent/agentService');
const authService = require('../authService');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { BadRequestError } = require('../../shared/http');

const BIND_CODE_TTL_MS = 15 * 60 * 1000;

/**
 * 渠道服务（当前实现微信 iLink）：
 * 外部账号 → 系统用户（绑定码）→ 复用 AgentService（同一套权限/确认/审计）
 */
class ChannelService {
  static async issueBindCode(user) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    await ChannelRepo.createBindCode(code, user.id, BIND_CODE_TTL_MS);
    return { code, expiresInSec: Math.round(BIND_CODE_TTL_MS / 1000) };
  }

  static async bind(channel, externalId, rawCode, displayName) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestError('绑定码不能为空');
    const row = await ChannelRepo.consumeBindCode(code);
    if (!row) throw new BadRequestError('绑定码无效或已过期，请在 App 内重新生成');
    await ChannelRepo.upsertBinding({ channel, externalId, userId: row.user_id, displayName });
    logger.info({ channel, userId: row.user_id }, 'channel bound');
    return row.user_id;
  }

  static async unbind(channel, externalId) {
    return ChannelRepo.unbindByExternal(channel, externalId);
  }

  static listBindings(userId) {
    return ChannelRepo.listBindings(userId);
  }

  static unbindById(userId, id) {
    return ChannelRepo.unbind(userId, id);
  }

  /**
   * 处理一条入站文本：
   * - /绑定 <code>、/解绑 为控制命令
   * - 其余交给 Agent（与站内完全一致的权限与确认机制）
   */
  static async handleInbound({ channel, externalId, displayName, text, app }) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return { reply: '' };

    const bindMatch = trimmed.match(/^[/／](?:绑定|bind)\s+([A-Za-z0-9]{4,16})$/);
    if (bindMatch) {
      const userId = await ChannelService.bind(channel, externalId, bindMatch[1], displayName);
      const u = await User.findById(userId);
      return {
        reply:
          '绑定成功：' + ((u && u.name) || userId) + '。\n现在可以直接说事，例如：\n' +
          '· 我的请假记录\n· 我要请明天早操的假\n· 给个建议：……\n' +
          '干部还可以问「今天有什么要处理的？」'
      };
    }

    if (/^[/／](?:解绑|unbind)$/.test(trimmed)) {
      const ok = await ChannelService.unbind(channel, externalId);
      return { reply: ok ? '已解除绑定。' : '当前没有绑定关系。' };
    }

    const binding = await ChannelRepo.findBinding(channel, externalId);
    if (!binding) {
      return {
        reply:
          '你还没有绑定账号。\n请在 App 的「办事助手 → 微信绑定」中生成绑定码，然后发送：\n/绑定 你的绑定码'
      };
    }

    const user = await User.findById(binding.user_id);
    if (!user) return { reply: '绑定的账号已不存在，请重新绑定。' };

    const token = authService.signToken(user);
    const result = await AgentService.chat(
      { id: user.id, name: user.name, role: user.role, class_id: user.class_id },
      token,
      { message: trimmed },
      app
    );

    let reply = result.reply || '（没有回复）';
    if (result.pendingAction) {
      reply += '\n\n回复「确认」执行，或回复「取消」放弃（也可在 App 内操作）。';
    }
    return { reply, pendingAction: result.pendingAction || null, conversationId: result.conversationId };
  }

  /** 微信侧确认：执行待确认动作 */
  static async confirm(userId, actionId, app) {
    const user = await User.findById(userId);
    if (!user) throw new BadRequestError('账号不存在');
    const token = authService.signToken(user);
    const result = await AgentService.confirm({ id: user.id, name: user.name, role: user.role }, token, actionId, app);
    return { reply: result.reply, success: result.success };
  }
}

module.exports = ChannelService;
