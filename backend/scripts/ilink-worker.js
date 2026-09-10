#!/usr/bin/env node
/**
 * 微信 iLink 长轮询 worker：把私聊消息转给 Agent，并回复结果。
 * 用法：node scripts/ilink-worker.js
 * 前置：backend/.env 配置 WEIXIN_ACCOUNT_ID / WEIXIN_TOKEN（由 scripts/ilink-login.js 获得）
 *
 * 行为：
 *  - 未绑定用户 → 提示发送 /绑定 <绑定码>
 *  - /解绑 → 解除绑定
 *  - 其余消息 → AgentService（站内同款权限/确认/审计）
 *  - Agent 返回待确认动作时，回复「确认」执行、「取消」放弃
 */
const fs = require('fs');
const { env } = require('../config/env');
const logger = require('../config/logger');
const ilink = require('../services/channel/ilinkClient');
const ChannelRepo = require('../services/channel/channelRepo');
const ChannelService = require('../services/channel/channelService');
const ChannelRepoMod = ChannelRepo;

const pendingByExternal = new Map(); // externalId -> actionId

function loadCreds() {
  if (env.WEIXIN_ACCOUNT_ID && env.WEIXIN_TOKEN) {
    return { account_id: env.WEIXIN_ACCOUNT_ID, token: env.WEIXIN_TOKEN, base_url: env.WEIXIN_BASE_URL };
  }
  try {
    const raw = fs.readFileSync(env.WEIXIN_CREDENTIALS_FILE, 'utf8');
    const j = JSON.parse(raw);
    if (j.account_id && j.token) return j;
  } catch (e) { /* ignore */ }
  return null;
}

async function main() {
  const creds = loadCreds();
  if (!creds) {
    console.error('未找到微信凭证：请先运行 node scripts/ilink-login.js，或配置 WEIXIN_ACCOUNT_ID / WEIXIN_TOKEN');
    process.exit(0);
  }
  const app = require('../app'); // 仅用于工具目录
  let syncBuf = await ChannelRepoMod.getSyncBuf('weixin', creds.account_id);
  console.log('[ilink] worker 已启动 account_id=' + creds.account_id + '，开始长轮询…');

  let failures = 0;
  for (;;) {
    try {
      const res = await ilink.getUpdates({ token: creds.token, syncBuf, timeoutMs: 35000 });
      failures = 0;
      if (res && res.get_updates_buf) {
        syncBuf = String(res.get_updates_buf);
        await ChannelRepoMod.setSyncBuf('weixin', creds.account_id, syncBuf);
      }
      const msgs = (res && res.msgs) || [];
      for (const msg of msgs) {
        const from = String(msg.from_user_id || '').trim();
        if (!from || from === creds.account_id) continue;
        const text = ilink.extractText(msg.item_list);
        if (!text) continue;
        const contextToken = String(msg.context_token || '').trim();
        const trimmed = text.trim();

        // 确认/取消
        if (/^[/／]?(确认|确定|yes|ok)$/i.test(trimmed) || trimmed === '1') {
          const actionId = pendingByExternal.get(from);
          if (!actionId) { await ilink.sendText({ token: creds.token, toUserId: from, text: '当前没有待确认操作。', contextToken }); continue; }
          try {
            const binding = await ChannelRepoMod.findBinding('weixin', from);
            const r = await ChannelService.confirm(binding.user_id, actionId, app);
            pendingByExternal.delete(from);
            await ilink.sendText({ token: creds.token, toUserId: from, text: r.reply, contextToken });
          } catch (e) {
            await ilink.sendText({ token: creds.token, toUserId: from, text: '执行失败：' + e.message, contextToken });
          }
          continue;
        }
        if (/^[/／]?(取消|算了|no|cancel)$/i.test(trimmed) || trimmed === '0') {
          pendingByExternal.delete(from);
          await ilink.sendText({ token: creds.token, toUserId: from, text: '好的，已取消。', contextToken });
          continue;
        }

        let out;
        try {
          out = await ChannelService.handleInbound({ channel: 'weixin', externalId: from, displayName: from, text: trimmed, app });
        } catch (e) {
          logger.warn({ err: e.message, from }, 'channel inbound failed');
          out = { reply: '处理失败：' + e.message };
        }
        if (out.pendingAction) pendingByExternal.set(from, out.pendingAction.id);
        if (out.reply) {
          await ilink.sendText({ token: creds.token, toUserId: from, text: out.reply, contextToken });
        }
      }
    } catch (e) {
      failures += 1;
      const delay = Math.min(30000, 2000 * failures);
      logger.warn({ err: e.message, failures }, 'ilink poll error, retry in ' + delay + 'ms');
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

main().catch((e) => { console.error('ILINK_WORKER_ERROR:', e.message); process.exit(1); });
