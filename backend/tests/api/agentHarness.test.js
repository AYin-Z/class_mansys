import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'class_manage_sys_test';
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
const ChannelService = require('../../services/channel/channelService');
const ChannelRepo = require('../../services/channel/channelRepo');

let ready = false;
let server = null;
let userA = null;
let userB = null;
let tokenA = null;
let tokenB = null;
const conversationIds = [];
const attachmentUrls = [];
const leaveIds = [];
const channelExternals = [];
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
    if (!userA || !userB) throw new Error('测试库缺少用户');
    ready = true;
  } catch (e) {
    throw new Error('测试库不可用，Harness 集成用例不允许静默跳过：' + e.message, { cause: e });
  }
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
    if (channelExternals.length) {
      await db.query('DELETE FROM agent_channel_sessions WHERE external_id IN (?)', [channelExternals]);
      await db.query('DELETE FROM agent_channel_bindings WHERE external_id IN (?)', [channelExternals]);
    }
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
  async function registerProof(label) {
    const url = '/uploads/agent/harness-' + label + '-' + crypto.randomBytes(4).toString('hex') + '.png';
    attachmentUrls.push(url);
    await AgentRepo.registerAttachment({
      userId: userA.id, url, name: label + '.png', mime: 'image/png', size: 20,
      sha256: crypto.randomBytes(32).toString('hex'), source: 'test'
    });
    return url;
  }

  it('RED→GREEN：草稿已收集字段真正并入 curated 写参数（第二轮只给 reason）', async () => {
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', {
        type: '午集合', start_time: ymd(1) + ' 13:00:00', end_time: ymd(1) + ' 13:30:00'
      }))
      .mockResolvedValueOnce(text('还差请假事由。'))
      .mockResolvedValueOnce(toolCall('apply_leave', { reason: REASON_PREFIX + '跨轮合并' }));

    const first = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(first.conversationId);
    expect(first.pendingAction).toBeNull();

    const second = await AgentService.chat(userA, tokenA, { conversationId: first.conversationId, message: '事由是家里有事', attachments: [] }, app);
    expect(second.pendingAction).toBeTruthy();
    const action = await AgentRepo.findAction(second.pendingAction.id);
    expect(action.params.type).toBe('午集合');
    expect(action.params.start_time).toContain(ymd(1));
    expect(action.params.reason).toBe(REASON_PREFIX + '跨轮合并');
  });

  it('RED→GREEN：草稿字段并入 module 工具的嵌套 params', async () => {
    const base = { action: 'POST /api/leave/apply' };
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('leave', {
        ...base, params: { type: '午集合', start_time: ymd(1) + ' 13:00:00', end_time: ymd(1) + ' 13:30:00' }
      }))
      .mockResolvedValueOnce(text('还差事由。'))
      .mockResolvedValueOnce(toolCall('leave', { ...base, params: { reason: REASON_PREFIX + '模块嵌套' } }));

    const first = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(first.conversationId);
    const second = await AgentService.chat(userA, tokenA, { conversationId: first.conversationId, message: '事由是家里有事', attachments: [] }, app);
    expect(second.pendingAction).toBeTruthy();
    const action = await AgentRepo.findAction(second.pendingAction.id);
    expect(action.params.action).toBe('POST /api/leave/apply');
    expect(action.params.params.type).toBe('午集合');
    expect(action.params.params.reason).toBe(REASON_PREFIX + '模块嵌套');
  });

  it('RED→GREEN：确认绑定会话当前 state_version（动作创建后两者必须相等）', async () => {
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '版本绑定' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const action = await AgentRepo.findAction(out.pendingAction.id);
    const conv = await AgentRepo.getConversationById(out.conversationId);
    expect(action.state_version).toBe(conv.state_version);
  });

  it('RED→GREEN：改口无新卡时旧确认立即失效', async () => {
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '改口无新卡' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;

    llm.chat.mockResolvedValueOnce(text('好的，我再等你确认。'));
    const turn = await AgentService.chat(userA, tokenA, { conversationId: out.conversationId, message: '等等，我再想想', attachments: [] }, app);
    expect(turn.pendingAction).toBeNull();

    const old = await AgentRepo.findAction(actionId);
    expect(old.status).not.toBe('pending');
    const rejected = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(rejected.success).toBe(false);
    expect(rejected.code).toBe('ACTION_INVALIDATED');
  });

  it('RED→GREEN：预校验失败也使旧确认失效', async () => {
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '预校验前旧卡' })))
      .mockResolvedValueOnce(toolCall('apply_leave', { ...leaveArgs({ reason: '非法类型' }), type: 2 }))
      .mockResolvedValueOnce(text('类型不对，请重说。'));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;

    await AgentService.chat(userA, tokenA, { conversationId: out.conversationId, message: '改成别的假', attachments: [] }, app);
    expect((await AgentRepo.findAction(actionId)).status).not.toBe('pending');
    const rejected = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(rejected.success).toBe(false);
    expect(rejected.code).toBe('ACTION_INVALIDATED');
  });

  it('RED→GREEN：会话 closed_at 后确认被拒，且动作作废', async () => {
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '关闭会话' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;
    await AgentRepo.closeConversation(out.conversationId, userA.id);

    const rejected = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(rejected.success).toBe(false);
    expect(rejected.code).toBe('CONVERSATION_CLOSED');
    expect((await AgentRepo.findAction(actionId)).status).not.toBe('pending');
  });

  it('RED→GREEN：确认阶段强制读取最新 leave_config（不吃 60s 缓存）', async () => {
    const [rows] = await db.query("SELECT start_time, end_time FROM leave_config WHERE type_name = '午集合'");
    const original = rows[0];
    preflight.clearLeaveConfigCache();
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '配置热更新' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;

    let rejected;
    try {
      // 模拟管理员在确认前把午集合窗口缩短，但进程内 60s 缓存仍持有旧配置
      await db.query("UPDATE leave_config SET end_time = '13:10:00' WHERE type_name = '午集合'");
      rejected = await AgentService.confirm(userA, tokenA, actionId, app);
    } finally {
      await db.query('UPDATE leave_config SET start_time = ?, end_time = ? WHERE type_name = ?', [original.start_time, original.end_time, '午集合']);
      preflight.clearLeaveConfigCache();
    }
    expect(rejected.success).toBe(false);
    expect(rejected.code).toBe('ACTION_INVALIDATED');
    const [leaves] = await db.query('SELECT * FROM leaves WHERE user_id = ? AND reason = ?', [userA.id, REASON_PREFIX + '配置热更新']);
    expect(leaves).toHaveLength(0);
  });

  it('RED→GREEN：无工具轮次补图进入任务草稿并使旧确认失效', async () => {
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '补图前' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;
    const url = await registerProof('new-proof');

    llm.chat.mockResolvedValueOnce(text('收到，这张图我记下了。'));
    await AgentService.chat(userA, tokenA, {
      conversationId: out.conversationId,
      message: '这是我的新证明',
      attachments: [{ url, name: 'new-proof.png', mime: 'image/png', size: 20 }]
    }, app);

    const conv = await AgentRepo.getConversationById(out.conversationId);
    expect((conv.state.attachments || []).map((a) => a.url)).toContain(url);
    expect((await AgentRepo.findAction(actionId)).status).not.toBe('pending');
    const rejected = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(rejected.code).toBe('ACTION_INVALIDATED');
  });

  it('RED→GREEN：附件可显式替换与清空（不再与旧草稿附件合并）', async () => {
    const a = await registerProof('proof-a');
    const b = await registerProof('proof-b');
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('apply_leave', { type: '午集合', start_time: ymd(1) + ' 13:00:00', end_time: ymd(1) + ' 13:30:00' }))
      .mockResolvedValueOnce(text('请补充事由与证明。'))
      .mockResolvedValueOnce(toolCall('apply_leave', { ...leaveArgs({ reason: '替换附件' }), attachments: [b] }));
    const first = await AgentService.chat(userA, tokenA, {
      message: '明天午集合请假', attachments: [{ url: a, name: 'a.png', mime: 'image/png', size: 20 }]
    }, app);
    conversationIds.push(first.conversationId);
    const second = await AgentService.chat(userA, tokenA, { conversationId: first.conversationId, message: '换成这张证明', attachments: [] }, app);
    const action = await AgentRepo.findAction(second.pendingAction.id);
    expect(action.params.attachments).toEqual([b]);
    const conv = await AgentRepo.getConversationById(first.conversationId);
    expect(conv.state.attachments.map((x) => x.url)).toEqual([b]);

    // 显式空数组 = 撤回全部附件
    llm.chat.mockResolvedValueOnce(toolCall('apply_leave', { ...leaveArgs({ reason: '清空附件' }), attachments: [] }));
    const third = await AgentService.chat(userA, tokenA, { conversationId: first.conversationId, message: '证明先不传了', attachments: [] }, app);
    const cleared = await AgentRepo.findAction(third.pendingAction.id);
    expect(cleared.params.attachments || []).toEqual([]);
    const conv2 = await AgentRepo.getConversationById(first.conversationId);
    expect(conv2.state.attachments || []).toEqual([]);
  });

  it('RED→GREEN：/撤回附件 清空草稿附件并使旧确认失效', async () => {
    const proof = await registerProof('revoke');
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', {
      ...leaveArgs({ reason: '撤回附件' }), attachments: [proof]
    }));
    const out = await AgentService.chat(userA, tokenA, {
      message: '明天午集合请假', attachments: [{ url: proof, name: 'revoke.png', mime: 'image/png', size: 20 }]
    }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;

    const turn = await AgentService.chat(userA, tokenA, { conversationId: out.conversationId, message: '/撤回附件', attachments: [] }, app);
    expect(turn.reply).toContain('已撤回');
    const conv = await AgentRepo.getConversationById(out.conversationId);
    expect(conv.state.attachments || []).toEqual([]);
    expect((await AgentRepo.findAction(actionId)).status).not.toBe('pending');
  });

  it('RED→GREEN：真实跨 chat/微信入站多轮续接同一会话，草稿合并且确认只执行一次', async () => {
    const external = 'harness_cross_' + crypto.randomBytes(4).toString('hex');
    channelExternals.push(external);
    await ChannelRepo.upsertBinding({ channel: 'weixin', externalId: external, userId: userA.id, displayName: '跨渠道测试' });
    vi.spyOn(llm, 'chat')
      .mockResolvedValueOnce(toolCall('my_leaves', {}))
      .mockResolvedValueOnce(text('这是你的请假记录。'))
      .mockResolvedValueOnce(toolCall('my_leaves', {}))
      .mockResolvedValueOnce(text('这是你的请假记录。'))
      .mockResolvedValueOnce(toolCall('apply_leave', { type: '午集合', start_time: ymd(1) + ' 13:00:00', end_time: ymd(1) + ' 13:30:00' }))
      .mockResolvedValueOnce(text('还差事由。'))
      .mockResolvedValueOnce(toolCall('apply_leave', { reason: REASON_PREFIX + '跨渠道' }));

    const ch1 = await ChannelService.handleInbound({ channel: 'weixin', externalId: external, text: '我的请假记录', app });
    conversationIds.push(ch1.conversationId);
    const appTurn = await AgentService.chat(userA, tokenA, { conversationId: ch1.conversationId, message: '再用 App 查一次', attachments: [] }, app);
    expect(appTurn.conversationId).toBe(ch1.conversationId);
    const ch2 = await ChannelService.handleInbound({ channel: 'weixin', externalId: external, text: '明天午集合请假', app });
    expect(ch2.conversationId).toBe(ch1.conversationId);
    const ch3 = await ChannelService.handleInbound({ channel: 'weixin', externalId: external, text: '事由是家里有事', app });
    expect(ch3.conversationId).toBe(ch1.conversationId);
    expect(ch3.pendingAction).toBeTruthy();
    const action = await AgentRepo.findAction(ch3.pendingAction.id);
    expect(action.params.type).toBe('午集合');
    expect(action.params.reason).toBe(REASON_PREFIX + '跨渠道');
    const conv = await AgentRepo.getConversationById(ch1.conversationId);
    expect(action.state_version).toBe(conv.state_version);

    const confirmed = await ChannelService.confirm(userA.id, action.id, app);
    expect(confirmed.success).toBe(true);
    expect(confirmed.already).toBe(false);
    const again = await ChannelService.confirm(userA.id, action.id, app);
    expect(again.already).toBe(true);
    const [leaves] = await db.query('SELECT id FROM leaves WHERE user_id = ? AND reason = ?', [userA.id, REASON_PREFIX + '跨渠道']);
    expect(leaves).toHaveLength(1);
    leaveIds.push(leaves[0].id);
  });

  it('RED→GREEN：取消后的动作确认返回 cancelled，不执行', async () => {
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '取消动作' })));
    const out = await AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app);
    conversationIds.push(out.conversationId);
    const actionId = out.pendingAction.id;
    await AgentRepo.markAction(actionId, 'cancelled', {});
    const r = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(r.success).toBe(false);
    expect(r.code).toBe('ACTION_CANCELLED');
    const [leaves] = await db.query('SELECT * FROM leaves WHERE user_id = ? AND reason = ?', [userA.id, REASON_PREFIX + '取消动作']);
    expect(leaves).toHaveLength(0);
  });

  it('RED→GREEN：/新会话 重置后旧动作确认返回 CONVERSATION_CLOSED', async () => {
    const external = 'harness_reset_' + crypto.randomBytes(4).toString('hex');
    channelExternals.push(external);
    await ChannelRepo.upsertBinding({ channel: 'weixin', externalId: external, userId: userA.id, displayName: '重置测试' });
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', leaveArgs({ reason: '重置会话' })));
    const first = await ChannelService.handleInbound({ channel: 'weixin', externalId: external, text: '明天午集合请假', app });
    conversationIds.push(first.conversationId);
    const actionId = first.pendingAction.id;

    const reset = await ChannelService.handleInbound({ channel: 'weixin', externalId: external, text: '/新会话', app });
    expect(reset.conversationId).not.toBe(first.conversationId);
    conversationIds.push(reset.conversationId);
    const rejected = await AgentService.confirm(userA, tokenA, actionId, app);
    expect(rejected.success).toBe(false);
    expect(rejected.code).toBe('CONVERSATION_CLOSED');
    expect((await AgentRepo.findAction(actionId)).status).not.toBe('pending');
  });

  it('RED→GREEN：模型显式塞入他人附件 URL 也会被 403 拒绝', async () => {
    const other = '/uploads/agent/harness-foreign-' + crypto.randomBytes(4).toString('hex') + '.png';
    attachmentUrls.push(other);
    await AgentRepo.registerAttachment({ userId: userB.id, url: other, name: 'B的证明.png', mime: 'image/png', size: 15, sha256: 'd'.repeat(64), source: 'test' });
    vi.spyOn(llm, 'chat').mockResolvedValueOnce(toolCall('apply_leave', {
      ...leaveArgs({ reason: '引用他人附件' }), attachments: [other]
    }));
    await expect(AgentService.chat(userA, tokenA, { message: '明天午集合请假', attachments: [] }, app)).rejects.toMatchObject({
      status: 403,
      code: 'ATTACHMENT_NOT_OWNED'
    });
  });

});
