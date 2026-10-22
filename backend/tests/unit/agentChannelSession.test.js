import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const db = require('../../config/database');
const AgentRepo = require('../../services/agent/repo');
const channelSession = require('../../services/agent/channelSession');
const attachmentAuth = require('../../services/agent/attachmentAuth');

let ready = false;
let userA = null;
let userB = null;
const external = 'harness_test_' + crypto.randomBytes(4).toString('hex');
const conversations = [];
const urls = [];

beforeAll(async () => {
  try {
    const [rows] = await db.query('SELECT id FROM users ORDER BY id LIMIT 2');
    userA = rows[0] && rows[0].id;
    userB = rows[1] && rows[1].id;
    ready = !!(userA && userB);
  } catch (e) {
    ready = false;
  }
});

afterAll(async () => {
  if (ready) {
    await db.query('DELETE FROM agent_channel_sessions WHERE external_id = ?', [external]);
    if (conversations.length) {
      await db.query('DELETE FROM agent_actions WHERE conversation_id IN (?)', [conversations]);
      await db.query('DELETE FROM agent_messages WHERE conversation_id IN (?)', [conversations]);
      await db.query('DELETE FROM agent_conversations WHERE id IN (?)', [conversations]);
    }
    if (urls.length) await db.query('DELETE FROM agent_attachments WHERE url IN (?)', [urls]);
  }
  try { await db.end(); } catch (e) { /* ignore */ }
});

describe('渠道会话指针（需要测试库）', () => {
  it('同一 (channel, external_id) 连续消息续接同一 conversationId', async () => {
    if (!ready) return;
    const first = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userA, title: '第一句' });
    conversations.push(first.conversationId);
    expect(first.isNew).toBe(true);
    const second = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userA, title: '第二句' });
    expect(second.conversationId).toBe(first.conversationId);
    expect(second.isNew).toBe(false);
  });

  it('/新会话 轮换：旧会话 closed_at 落库，新 id 不同', async () => {
    if (!ready) return;
    const before = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userA });
    const reset = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userA, reset: true });
    conversations.push(reset.conversationId);
    expect(reset.conversationId).not.toBe(before.conversationId);
    expect(reset.rotated).toBe(true);
    const old = await AgentRepo.getConversationById(before.conversationId);
    expect(old.closed_at).toBeTruthy();
  });

  it('空闲 12h 自动轮换，且拒绝 A/B 用户串会话', async () => {
    if (!ready) return;
    const cur = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userA });
    const later = new Date(Date.now() + channelSession.IDLE_MS + 60 * 1000);
    const rotated = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userA, now: later });
    conversations.push(rotated.conversationId);
    expect(rotated.conversationId).not.toBe(cur.conversationId);
    expect(rotated.reason).toBe('expired');

    const changed = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userB });
    conversations.push(changed.conversationId);
    expect(changed.reason).toBe('user_changed');
    expect(changed.conversationId).not.toBe(rotated.conversationId);
    const oldConv = await AgentRepo.getConversationById(rotated.conversationId);
    expect(oldConv.closed_at).toBeTruthy();
    // 新用户拿不到旧用户会话
    expect(await AgentRepo.getConversation(rotated.conversationId, userB)).toBeNull();
  });

  it('解绑关闭指针与会话', async () => {
    if (!ready) return;
    const cur = await channelSession.resolveSession({ channel: 'weixin', externalId: external, userId: userA });
    conversations.push(cur.conversationId);
    expect(await channelSession.closeSession({ channel: 'weixin', externalId: external })).toBe(true);
    const closed = await AgentRepo.getConversationById(cur.conversationId);
    expect(closed.closed_at).toBeTruthy();
    const row = await AgentRepo.findChannelSession('weixin', external);
    expect(row.status).not.toBe('active');
  });

  it('入站消息去重：同一 message_id 第二次返回 false', async () => {
    if (!ready) return;
    const mid = 'msg_' + crypto.randomBytes(4).toString('hex');
    expect(await AgentRepo.markInboundSeen('weixin', external, mid)).toBe(true);
    expect(await AgentRepo.markInboundSeen('weixin', external, mid)).toBe(false);
    await db.query('DELETE FROM agent_inbound_dedup WHERE external_id = ?', [external]);
  });
});

describe('附件所有权（需要测试库）', () => {
  it('本人附件通过，他人 / 未登记一律 403', async () => {
    if (!ready) return;
    const url = '/uploads/agent/harness-' + crypto.randomBytes(4).toString('hex') + '.png';
    urls.push(url);
    await AgentRepo.registerAttachment({ userId: userA, url, name: '证明.png', mime: 'image/png', size: 12, sha256: 'a'.repeat(64), source: 'test' });

    const ok = await attachmentAuth.authorize(userA, [{ url, name: '证明.png', mime: 'image/png' }]);
    expect(ok).toHaveLength(1);
    expect(ok[0].sha256).toBe('a'.repeat(64));

    await expect(attachmentAuth.authorize(userB, [{ url }])).rejects.toMatchObject({ status: 403, code: 'ATTACHMENT_NOT_OWNED' });
    await expect(attachmentAuth.authorize(userA, [{ url: '/uploads/agent/not-registered.png' }])).rejects.toMatchObject({
      status: 403,
      code: 'ATTACHMENT_NOT_REGISTERED'
    });
    const owned = await attachmentAuth.filterOwned(userB, [{ url }]);
    expect(owned).toEqual([]);
  });
});
