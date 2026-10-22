import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const taskState = require('../../services/agent/taskState');

describe('任务草稿状态机', () => {
  it('同一工具的活跃草稿保留旧字段，新值覆盖，附件累积去重', () => {
    const prev = {
      tool: 'apply_leave',
      status: 'collecting',
      fields: { type: '午集合', start_time: '2026-10-23 13:00:00', end_time: '2026-10-23 13:30:00' },
      attachments: [{ url: '/uploads/a.png', name: 'a.png' }],
      revision: 2
    };
    const next = taskState.mergeDraft(prev, {
      tool: 'apply_leave',
      args: { start_time: '2026-10-23 13:10:00', reason: '病假' },
      attachments: [{ url: '/uploads/a.png' }, { url: '/uploads/b.png' }]
    });
    expect(next.fields.type).toBe('午集合');
    expect(next.fields.start_time).toBe('2026-10-23 13:10:00');
    expect(next.fields.reason).toBe('病假');
    expect(next.attachments.map((a) => a.url)).toEqual(['/uploads/a.png', '/uploads/b.png']);
    expect(next.revision).toBe(3);
    expect(next.status).toBe('collecting');
  });

  it('换工具 / 已完成 / 已失败后重新开始时，不继承旧附件', () => {
    const completed = {
      tool: 'apply_leave',
      status: 'completed',
      fields: { type: '午集合' },
      attachments: [{ url: '/uploads/old-proof.png' }],
      revision: 9
    };
    const fresh = taskState.mergeDraft(completed, {
      tool: 'apply_leave',
      args: { type: '早集合' },
      attachments: []
    });
    expect(fresh.attachments).toEqual([]);
    expect(fresh.fields.type).toBe('早集合');
  });

  it('失败状态仍可合并（用户补正），last_error 清空', () => {
    const failed = { tool: 'apply_leave', status: 'failed', fields: { type: 2 }, attachments: [], last_error: { code: 'INVALID_LEAVE_TYPE' }, revision: 4 };
    const next = taskState.mergeDraft(failed, { tool: 'apply_leave', args: { type: '午集合' } });
    expect(next.fields.type).toBe('午集合');
    expect(next.last_error).toBeNull();
    expect(next.status).toBe('collecting');
  });

  it('生成待确认动作时绑定字段与附件，确认成功后 completed', () => {
    const draft = { tool: 'apply_leave', status: 'collecting', fields: { type: '午集合' }, attachments: [{ url: '/uploads/a.png' }], revision: 1 };
    const awaiting = taskState.toAwaitingConfirm(draft, { type: '午集合', reason: '病假' });
    expect(awaiting.status).toBe('awaiting_confirm');
    expect(awaiting.fields.reason).toBe('病假');
    expect(awaiting.attachments[0].url).toBe('/uploads/a.png');
    const done = taskState.markCompleted(awaiting);
    expect(done.status).toBe('completed');
    const failed = taskState.markFailed(awaiting, { code: 'X', message: '坏了' });
    expect(failed.status).toBe('failed');
    expect(failed.last_error.message).toBe('坏了');
  });

  it('草稿有证明、模型本轮没重复给 URL 时自动补进 apply_leave 参数', () => {
    const attachments = [{ url: '/uploads/a.png', name: 'a.png' }];
    const curated = taskState.withDraftAttachments({ name: 'apply_leave', kind: 'curated' }, { type: '午集合' }, attachments);
    expect(curated.attachments).toEqual(['/uploads/a.png']);

    const moduleTool = { name: 'leave', kind: 'module' };
    const mod = taskState.withDraftAttachments(moduleTool, { action: 'POST /api/leave/apply', params: { type: '午集合' } }, attachments);
    expect(mod.params.attachments).toEqual(['/uploads/a.png']);
  });

  it('prompt 块包含工具/字段/附件/上次失败，且不含系统提示词前缀', () => {
    const block = taskState.promptBlock({
      tool: 'apply_leave',
      status: 'failed',
      fields: { type: '午集合' },
      attachments: [{ url: '/uploads/a.png', name: '证明.png' }],
      last_error: { code: 'MISSING_REASON', message: '请填写事由' },
      revision: 3
    });
    expect(block).toContain('apply_leave');
    expect(block).toContain('午集合');
    expect(block).toContain('证明.png');
    expect(block).toContain('MISSING_REASON');
    expect(block.startsWith('【当前任务草稿】')).toBe(true);
  });
});
