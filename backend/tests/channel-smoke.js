#!/usr/bin/env node
/**
 * 渠道链路冒烟：不依赖微信，直接驱动 ChannelService，验证
 *   生成绑定码 → /绑定 → 普通消息走 Agent → 写操作待确认 → 确认执行 → /解绑
 * 用法（对测试库 + 测试端口）：
 *   DB_NAME=class_manage_sys_test NODE_ENV=test AGENT_LLM_MODE=mock SELF_BASE_URL=http://127.0.0.1:3102 \
 *     node tests/channel-smoke.js
 */
const path = require('path');
const db = require('../config/database');
const ChannelRepo = require('../services/channel/channelRepo');
const ChannelService = require('../services/channel/channelService');

const EXTERNAL = 'smoke_external_user';
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const app = require('../app'); // 仅取工具目录，不 listen
  const [rows] = await db.query('SELECT id, name FROM users WHERE class_id IS NOT NULL ORDER BY id LIMIT 1');
  const user = rows[0];
  if (!user) { console.error('测试库缺少可用用户'); process.exit(1); }

  const { code } = await ChannelService.issueBindCode(user);
  check('生成绑定码', /^[A-Z0-9]{6}$/.test(code), code);

  const badBind = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '/绑定 ZZZZZZ', app });
  check('错误绑定码被拒', /无效或已过期/.test(badBind.reply), badBind.reply);

  const bind = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '/绑定 ' + code, app });
  check('绑定成功', /绑定成功/.test(bind.reply), bind.reply);
  const binding = await ChannelRepo.findBinding('weixin', EXTERNAL);
  check('绑定关系落库', !!binding && String(binding.user_id) === String(user.id), JSON.stringify(binding || {}));

  const reuse = await ChannelService.handleInbound({ channel: 'weixin', externalId: 'other_user', text: '/绑定 ' + code, app });
  check('绑定码一次性（不可复用）', /无效或已过期/.test(reuse.reply), reuse.reply);

  const read = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '我的请假记录', app });
  check('读消息走 Agent 并回复', !!read.reply && read.reply.length > 2, JSON.stringify(read.reply).slice(0, 120));

  // 连续 5 轮必须续接同一会话（旧实现每条消息新建会话，图片/草稿/确认全丢）
  const convIds = [];
  for (let i = 0; i < 5; i += 1) {
    const r = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '我的请假记录', app });
    convIds.push(r.conversationId);
  }
  check('连续 5 轮同一 conversationId', new Set(convIds).size === 1 && !!convIds[0], JSON.stringify(convIds));

  const reset = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '/新会话', app });
  check('/新会话 轮换会话', !!reset.conversationId && reset.conversationId !== convIds[0], JSON.stringify(reset));
  const afterReset = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '我的请假记录', app });
  check('/新会话 后消息进入新会话', afterReset.conversationId === reset.conversationId, JSON.stringify({ reset, afterReset }));

  const write = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '我要请假：明天午集合，事由：渠道冒烟', app });
  check('写消息返回待确认动作', !!write.pendingAction && /确认/.test(write.reply), JSON.stringify(write).slice(0, 200));
  if (write.pendingAction) {
    const confirmed = await ChannelService.confirm(user.id, write.pendingAction.id, app);
    check('确认后执行成功', confirmed.success === true && confirmed.already === false, JSON.stringify(confirmed).slice(0, 200));
    const again = await ChannelService.confirm(user.id, write.pendingAction.id, app);
    check('重复确认幂等（不再执行）', again.already === true && again.success === true && /已经执行过/.test(again.reply), JSON.stringify(again).slice(0, 200));
  } else {
    check('确认后执行成功', false, 'no pendingAction');
    check('重复确认幂等（不再执行）', false, 'no pendingAction');
  }

  const unbound = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '/解绑', app });
  check('解绑成功', /已解除绑定/.test(unbound.reply), unbound.reply);
  const after = await ChannelRepo.findBinding('weixin', EXTERNAL);
  check('解绑后不再命中绑定', !after);

  const hint = await ChannelService.handleInbound({ channel: 'weixin', externalId: EXTERNAL, text: '我的请假记录', app });
  check('未绑定用户收到绑定指引', /绑定码/.test(hint.reply), hint.reply);

  await db.query("DELETE FROM leaves WHERE user_id = ? AND reason = '渠道冒烟'", [user.id]);
  await db.query('DELETE FROM agent_bind_codes WHERE user_id = ?', [user.id]);
  console.log('\n渠道冒烟：PASS ' + pass + '  FAIL ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CHANNEL_SMOKE_ERROR:', e.message); process.exit(1); });
