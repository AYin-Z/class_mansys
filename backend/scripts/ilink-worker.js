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
const AgentRepo = require('../services/agent/repo');
const ilinkMedia = require('../services/channel/ilinkMedia');
const mediaIntake = require('../services/channel/mediaIntake');
const mediaService = require('../services/mediaService');
const ilink = require('../services/channel/ilinkClient');
const ChannelRepo = require('../services/channel/channelRepo');
const ChannelService = require('../services/channel/channelService');
const ChannelRepoMod = ChannelRepo;


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


/**
 * 把回复里的 Markdown 图片真的发到微信。
 * 单条最多 3 张（微信里连发图片很打扰），超出只发前 3 张并提示去 App 看全部。
 */
async function sendReplyImages(reply, { token, toUserId, contextToken, cdnBaseUrl }) {
  const urls = [];
  const re = /!\[[^\]]*\]\((\/uploads\/[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(String(reply || ''))) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  if (!urls.length) return;
  for (const url of urls.slice(0, 3)) {
    try {
      const abs = mediaService.urlToAbsPath(url);
      const buf = fs.readFileSync(abs);
      await ilinkMedia.uploadAndSend({
        apiPost: ilink.apiPost,
        token,
        toUserId,
        contextToken,
        buffer: buf,
        filename: abs.split('/').pop(),
        kind: /\.(jpe?g|png|gif|webp)$/i.test(abs) ? 'image' : 'file',
        cdnBaseUrl
      });
    } catch (e) {
      logger.warn({ err: e.message, url }, 'weixin reply image send failed');
    }
  }
  if (urls.length > 3) {
    try {
      await ilink.sendText({ token, toUserId, contextToken, text: '（另有 ' + (urls.length - 3) + ' 张图片，请在 App 中查看）' });
    } catch (e) { /* 忽略 */ }
  }
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
        const contextToken = String(msg.context_token || '').trim();
        let text = ilink.extractText(msg.item_list);
        const mediaRefs = ilinkMedia.extractMediaItems(msg.item_list);
        // 以前这里直接 `if (!text) continue`，导致**图片被静默丢弃**：
        // 用户发请假证明照片过去，什么都没发生也没有任何提示——最糟的一种失败。
        if (!text && !mediaRefs.length) continue;

        // 语音消息自带转写文本，没有其他文字时直接当文本用（Hermes 同款做法）
        if (!text) {
          const voice = mediaRefs.find((m) => m.voiceText);
          if (voice) text = voice.voiceText;
        }

        // 媒体要先落到系统里，才能作为附件交给 Agent（请假证明、相册照片）
        let attachments = [];
        if (mediaRefs.length) {
          const bindingForMedia = await ChannelRepoMod.findBinding('weixin', from);
          if (!bindingForMedia) {
            await ilink.sendText({
              token: creds.token, toUserId: from, contextToken,
              text: '收到你的文件，但当前还没绑定账号，无法归档。\n请先发送：/绑定 <绑定码>'
            });
            continue;
          }
          for (const ref of mediaRefs) {
            try {
              const buf = await ilinkMedia.downloadMedia(ref, { cdnBaseUrl: creds.cdn_base_url });
              const att = await mediaIntake.saveInboundMedia(buf, {
                kind: ref.kind, filename: ref.filename, ownerId: bindingForMedia.user_id
              });
              attachments.push({ url: att.url, name: att.name, mime: att.mime, size: att.size });
            } catch (e) {
              logger.warn({ err: e.message, kind: ref.kind }, 'wechat inbound media failed');
              await ilink.sendText({
                token: creds.token, toUserId: from, contextToken,
                text: '这张' + (ref.kind === 'image' ? '图片' : '文件') + '没能接收成功（' + e.message + '），请在 App 里上传。'
              });
            }
          }
          if (!text) text = attachments.length ? '（发来' + attachments.length + '个附件）' : '';
        }
        const trimmed = String(text || '').trim();
        if (!trimmed && !attachments.length) continue;

        // 确认 / 取消
        //
        // 以前的实现把 actionId 存在进程内的 Map 里，worker 一重启（Restart=always）映射就没了，
        // 用户回复「确认」会被告知"没有待确认操作"——而卡片明明还在聊天记录里。
        // 现在改为每次都从库里查该用户最近一条仍有效的待确认动作，天然跨重启。
        const isConfirm = /^[/／]?(确认|确定|yes|ok)$/i.test(trimmed) || trimmed === '1' || /^[/／]?确认\s*\d{4}$/.test(trimmed);
        if (isConfirm) {
          try {
            const binding = await ChannelRepoMod.findBinding('weixin', from);
            if (!binding) { await ilink.sendText({ token: creds.token, toUserId: from, text: '尚未绑定账号，请先发送：/绑定 <绑定码>', contextToken }); continue; }
            const pending = await AgentRepo.latestPendingAction(binding.user_id);
            if (!pending) { await ilink.sendText({ token: creds.token, toUserId: from, text: '当前没有待确认操作（可能已过期或已处理）。', contextToken }); continue; }
            // 高危操作必须带对短码：码由 actionId 派生，用户得把影响面那行看一眼才打得出来
            if (pending.risk === 'high') {
              const codeInText = (trimmed.match(/(\d{4})$/) || [])[1];
              const expected = ChannelService.confirmCode(pending.id);
              if (codeInText !== expected) {
                await ilink.sendText({
                  token: creds.token, toUserId: from,
                  text: '这是高影响操作，为避免误触需要确认码。\n请回复：确认 ' + expected + '\n放弃请回复：取消',
                  contextToken
                });
                continue;
              }
            }
            const r = await ChannelService.confirm(binding.user_id, pending.id, app);
            await ilink.sendText({ token: creds.token, toUserId: from, text: ChannelService.toPlainText(r.reply), contextToken });
          } catch (e) {
            await ilink.sendText({ token: creds.token, toUserId: from, text: '执行失败：' + e.message, contextToken });
          }
          continue;
        }
        // 撤销：撤回最近一次写操作（通知撤回、积分回滚…）
        if (/^[/／]?(撤销|撤回|undo)$/i.test(trimmed)) {
          try {
            const binding = await ChannelRepoMod.findBinding('weixin', from);
            if (!binding) { await ilink.sendText({ token: creds.token, toUserId: from, text: '尚未绑定账号，请先发送：/绑定 <绑定码>', contextToken }); continue; }
            const r = await ChannelService.undo(binding.user_id, app);
            await ilink.sendText({ token: creds.token, toUserId: from, text: ChannelService.toPlainText(r.reply), contextToken });
          } catch (e) {
            await ilink.sendText({ token: creds.token, toUserId: from, text: '撤销失败：' + e.message, contextToken });
          }
          continue;
        }
        if (/^[/／]?(取消|算了|no|cancel)$/i.test(trimmed) || trimmed === '0') {
          // 取消：把库里那条待确认动作标记掉，否则它会一直"待确认"到过期
          try {
            const binding = await ChannelRepoMod.findBinding('weixin', from);
            if (binding) {
              const pending = await AgentRepo.latestPendingAction(binding.user_id);
              if (pending) await AgentRepo.markAction(pending.id, 'cancelled', {});
            }
          } catch (e) {
            logger.warn({ err: e.message }, 'cancel pending action failed');
          }
          await ilink.sendText({ token: creds.token, toUserId: from, text: '好的，已取消。', contextToken });
          continue;
        }

        let out;
        try {
          out = await ChannelService.handleInbound({ channel: 'weixin', externalId: from, displayName: from, text: trimmed, attachments, app });
        } catch (e) {
          logger.warn({ err: e.message, from }, 'channel inbound failed');
          out = { reply: '处理失败：' + e.message };
        }
        if (out.reply) {
          await ilink.sendText({ token: creds.token, toUserId: from, text: out.reply, contextToken });
          // 回复里如果带 Markdown 图片（如助手展示相册照片），微信里必须真把图发出去——
          // 微信不渲染 Markdown，只发 `![说明](/uploads/x.jpg)` 用户看到的就是一串路径。
          await sendReplyImages(out.reply, { token: creds.token, toUserId: from, contextToken, cdnBaseUrl: creds.cdn_base_url });
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
