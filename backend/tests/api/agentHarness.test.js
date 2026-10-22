import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';
process.env.AGENT_LLM_MODE = 'mock';

const require = createRequire(import.meta.url);
const db = require('../../config/database');
const app = require('../../app');
const { env } = require('../../config/env');
const authService = require('../../services/authService');
const AgentService = require('../../services/agent/agentService');
const AgentRepo = require('../../services/agent/repo');
const llm = require('../../services/agent/llm');
const preflight = require('../../services/agent/preflight');

let ready = false;
let server = null;
let userA = null;
let userB = null;
let tokenA = null;
let tokenB = null;
const conversationIds = [];
const attachmentUrls = [];
const leaveIds = [];
const REASON_PREFIX = 'HARNESS_TEST_' + crypto.randomBytes(3).toString('hex') + '_';

function ymd(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function toolCall(name, args, id) {
  return {
    content: '',
    tool_calls: [{ id: id || 'call_' + crypto.randomBytes(4).toString('hex'), type: 'function', function: { name, arguments: JSON.stringify(args) } }],
    servedBy: 'mock',
    model: 'mock'
  };
}

const text = (content) => ({ content, tool_calls: [], servedBy: 'mock', model: 'mock' });

function leaveArgs(over) {
  const o = { ...(over || {}) };
  const reason = o.reason;
  delete o.reason;
  return {
    type: '午集合',
    start_time: ymd(1) + ' 13:00:00',
    end_time: ymd(1) + ' 13:30:00',
    reason: reason === '' ? '' : REASON_PREFIX + (reason || '病假'),
    ...o
  };
}

beforeAll(async () => {
  try {
    const [rows] = await db.query('SELECT id, name, role, class_id, openid, token_version FROM users ORDER BY id LIMIT 2');
    userA = rows[0];
    userB = rows[1];
    ready = !!(userA && userB);
  } catch (e) {
    ready = false;
  }
  if (!ready) return;
  tokenA = authService.signToken(userA);
  tokenB = authService.signToken(userB);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  env.SELF_BASE_URL = 'http://127.0.0.1:' + server.address().port;
  preflight.clearLeaveConfigCache();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  vi.restoreAllMocks();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (ready) {
    if (conversationIds.length) {
      await db.query('DELETE FROM agent_actions WHERE conversation_id IN (?)', [conversationIds]);
      await db.query('DELETE FROM agent_undo WHERE conversation_id IN (?)', [conversationIds]);
      await db.query('DELETE FROM agent_messages WHERE conversation_id IN (?)', [conversationIds]);
      await db.query('DELETE FROM agent_conversations WHERE id IN (?)', [conversationIds]);
    }
    if (attachmentUrls.length) await db.query('DELETE FROM agent_attachments WHERE url IN (?)', [attachmentUrls]);
    if (leaveIds.length) await db.query('DELETE FROM leaves WHERE id IN (?)', [leaveIds]);
    await db.query("DELETE FROM leaves WHERE reason LIKE ?", [REASON_PREFIX + '%']);
  }
  try { await db.end(); } catch (e) { /* ignore */ }
});

describe('Harness 多轮与确认（需要测试库 + 本地测试端口）', () => {
  it('无效 type / 固定时段在生成确认卡片前被拦截，两次纠错后给用户明确原因', async () => {
    if (!ready) return;
    const spy = vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', {
        type: 2,
        start_time: ymd(1) + ' 13:00:00',
        end_time: ymd(1) + ' 13:30:00',
        reason: REASON_PREFIX + '数字类型'
      }))
      .mockResolvedValueOnce(toolCall('apply_leave', {
        type: '午集合',
        start_time: ymd(1) + ' 14:00:00',
        end_time: ymd(1) + ' 14:30:00',
        reason: REASON_PREFIX + '错误窗口'
      }));

    const out = await AgentService.chat(userA, tokenA, { message: '明天下午集合请个假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(out.pendingAction).toBeNull();
    expect(out.reply).toContain('这次没能提交');
    expect(out.reply).toContain('午集合');

    const conv = await AgentRepo.getConversationById(out.conversationId);
    expect(conv.state.status).toBe('failed');
    expect(conv.state.last_error.code).toBe('LEAVE_OUTSIDE_WINDOW');
    expect(await AgentRepo.latestPendingAction(userA.id, out.conversationId)).toBeNull();
  });

  it('补图 → 缺事由 → 补正 → 草稿附件保留 → 确认成功（真实调用请假 API）', async () => {
    if (!ready) return;
    const url = '/uploads/agent/harness-proof-' + crypto.randomBytes(4).toString('hex') + '.png';
    attachmentUrls.push(url);
    await AgentRepo.registerAttachment({
      userId: userA.id, url, name: '请假证明.png', mime: 'image/png', size: 32,
      sha256: 'b'.repeat(64), source: 'test'
    });

    const spy = vi.spyOn(llm, 'chat')
      // 第一轮故意缺 reason
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '' })))
      // 第二轮补上 reason，但没有重复给附件 URL（模型只记得"那是我的证明"）
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '家里有事' })));

    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假，这是证明', attachments: [{ url, name: '请假证明.png', mime: 'image/png', size: 32 }] }, app);
    conversationIds.push(out.conversationId);
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(out.pendingAction).toBeTruthy();

    const action = await AgentRepo.findAction(out.pendingAction.id);
    expect(action.params.type).toBe('午集合');
    expect(action.params.attachments).toContain(url);
    expect(action.params_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(action.config_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(action.state_version).toBeGreaterThan(0);

    const conv = await AgentRepo.getConversationById(out.conversationId);
    expect(conv.state.status).toBe('awaiting_confirm');
    expect(conv.state.attachments.map((a) => a.url)).toContain(url);

    // 确认时不再调用模型，只复用 action 快照并复验
    spy.mockClear();
    const confirmed = await AgentService.confirm(userA, tokenA, action.id, app);
    expect(confirmed.success).toBe(true);
    expect(confirmed.already).toBe(false);
    expect(confirmed.reply).toContain('已执行');
    expect(spy).not.toHaveBeenCalled();

    const [leaves] = await db.query('SELECT * FROM leaves WHERE user_id = ? AND reason LIKE ? ORDER BY id DESC LIMIT 1', [userA.id, REASON_PREFIX + '%']);
    expect(leaves.length).toBe(1);
    leaveIds.push(leaves[0].id);
    expect(String(leaves[0].attachments || '')).toContain(url);

    const done = await AgentRepo.getConversationById(out.conversationId);
    expect(done.state.status).toBe('completed');

    // 重复确认：幂等，不再执行
    const again = await AgentService.confirm(userA, tokenA, action.id, app);
    expect(again.already).toBe(true);
    expect(again.success).toBe(true);
  });

  it('并发确认只能执行一次，另一次返回「已处理」', async () => {
    if (!ready) return;
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '并发' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;

    const [a, b] = await Promise.all([
      AgentService.confirm(userA, tokenA, actionId, app),
      AgentService.confirm(userA, tokenA, actionId, app)
    ]);
    const fresh = [a, b].filter((x) => x.already === false);
    const replay = [a, b].filter((x) => x.already === true);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].success).toBe(true);
    expect(replay).toHaveLength(1);
    // 并发时另一个可能看到 executing；串行再确认必须得到 executed 的幂等回复
    const after = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(after.already).toBe(true);
    expect(after.success).toBe(true);

    const [leaves] = await db.query('SELECT * FROM leaves WHERE user_id = ? AND reason = ?', [userA.id, REASON_PREFIX + '并发']);
    expect(leaves).toHaveLength(1);
    leaveIds.push(leaves[0].id);
  });

  it('改口生成新动作后，旧 pending 被 superseded，确认旧卡片被拒且无副作用', async () => {
    if (!ready) return;
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '旧版本' })))
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '新版本', start_time: ymd(2) + ' 13:00:00', end_time: ymd(2) + ' 13:30:00' })));

    const first = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(first.conversationId);
    const oldId = first.pendingAction.id;

    const second = await AgentService.chat(userA, tokenA, { conversationId: first.conversationId, message: '不对，是后天，事由改成家里有事', attachments: [] }, app);
    expect(second.pendingAction.id).not.toBe(oldId);

    const oldRow = await AgentRepo.findAction(oldId);
    expect(oldRow.status).toBe('superseded');

    const rejected = await AgentService.confirm(userA, tokenA, oldId, app);
    expect(rejected.success).toBe(false);
    expect(rejected.code).toBe('ACTION_INVALIDATED');
    const [leaves] = await db.query('SELECT * FROM leaves WHERE user_id = ? AND reason = ?', [userA.id, REASON_PREFIX + '旧版本']);
    expect(leaves).toHaveLength(0);
    // 新动作保持 pending，供用户确认
    expect((await AgentRepo.findAction(second.pendingAction.id)).status).toBe('pending');
  });

  it('流式对话同样走草稿/预校验，并推送 pending 事件', async () => {
    if (!ready) return;
    vi.spyOn(llm, 'chatStream').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '流式' })));
    const events = [];
    const out = await AgentService.chatStream(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app, (e) => events.push(e));
    conversationIds.push(out.conversationId);
    expect(out.pendingAction).toBeTruthy();
    expect(events.some((e) => e.type === 'pending')).toBe(true);
    const conv = await AgentRepo.getConversationById(out.conversationId);
    expect(conv.state.tool).toBe('apply_leave');
    expect(conv.state.status).toBe('awaiting_confirm');
  });

  it('确认前复验：配置哈希变化 → invalidated，零副作用', async () => {
    if (!ready) return;
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '配置变更' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;
    await db.query('UPDATE agent_actions SET config_hash = ? WHERE id = ?', ['0'.repeat(64), actionId]);
    const rejected = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(rejected.success).toBe(false);
    expect(rejected.code).toBe('ACTION_INVALIDATED');
    expect((await AgentRepo.findAction(actionId)).status).toBe('invalidated');
    const [leaves] = await db.query('SELECT * FROM leaves WHERE user_id = ? AND reason = ?', [userA.id, REASON_PREFIX + '配置变更']);
    expect(leaves).toHaveLength(0);
  });

  it('用户隔离：B 不能确认 A 的动作，也不能引用 A 的附件', async () => {
    if (!ready) return;
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '隔离' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);

    await expect(AgentService.confirm(userB, tokenB, out.pendingAction.id, app)).rejects.toMatchObject({ status: 403 });
    expect(await AgentRepo.getConversation(out.conversationId, userB.id)).toBeNull();

    const url = '/uploads/agent/harness-other-' + crypto.randomBytes(4).toString('hex') + '.png';
    attachmentUrls.push(url);
    await AgentRepo.registerAttachment({ userId: userA.id, url, name: 'A的证明.png', mime: 'image/png', size: 10, sha256: 'c'.repeat(64), source: 'test' });
    await expect(
      AgentService.chat(userB, tokenB, { message: '帮我请假', attachments: [{ url, name: 'A的证明.png', mime: 'image/png' }] }, app)
    ).rejects.toMatchObject({ status: 403, code: 'ATTACHMENT_NOT_OWNED' });
  });
});
