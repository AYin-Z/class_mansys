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

/**
 * 高危操作的确认短码：由 actionId 派生，稳定可复算（不需要额外存）。
 * 用户必须把这个码打出来，等于强制他把影响面那行字看一眼。
 */
function confirmCode(actionId) {
  const n = Number(actionId) || 0;
  return String((n * 7919) % 10000).padStart(4, '0');
}

/** 微信不渲染 Markdown：把 **粗体**、`代码`、# 标题、- 列表这些符号去掉，免得满屏星号 */
function toPlainText(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ''))
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '· ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
      let userId;
      try {
        userId = await ChannelService.bind(channel, externalId, bindMatch[1], displayName);
      } catch (e) {
        logger.warn({ err: e.message, channel, externalId }, 'channel bind failed');
        return { reply: '绑定失败：' + e.message + '\n请在 App 的「办事助手 → 微信助手 & MCP 接入」中重新生成绑定码。' };
      }
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

    let reply = toPlainText(result.reply || '（没有回复）');
    const pa = result.pendingAction;
    if (pa) {
      // 微信里没有按钮，只能靠文字确认。三件事必须做：
      // 1) 把影响面贴出来——App 里它单独成块，微信里不能丢，否则用户没有任何判断依据；
      // 2) 高危操作要求回一个短码而不是「确认」——微信里回两个字比点按钮还省事，
      //    是最容易闭眼确认的场景，必须加一点摩擦（要求把码看一遍再打出来）；
      // 3) 普通操作仍是「确认」，避免日常太啰嗦。
      if (pa.impact) reply += '\n\n⚠ ' + pa.impact;
      if (pa.risk === 'high') {
        const code = confirmCode(pa.id);
        reply += '\n\n这是高影响操作。确认请回复：确认 ' + code + '\n放弃请回复：取消';
      } else {
        reply += '\n\n回复「确认」执行，回复「取消」放弃（也可在 App 内操作）。';
      }
    }
    return { reply, pendingAction: pa || null, conversationId: result.conversationId };
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
module.exports.toPlainText = toPlainText;
module.exports.confirmCode = confirmCode;
