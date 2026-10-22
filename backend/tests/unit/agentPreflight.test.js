import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const preflight = require('../../services/agent/preflight');

const tool = { name: 'apply_leave', kind: 'curated', body: ['type', 'start_time', 'end_time', 'reason', 'attachments'] };

function ymd(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

let ready = false;
beforeAll(async () => {
  try {
    const cfg = await preflight.loadLeaveConfig(true);
    ready = cfg.list.length > 0;
  } catch (e) {
    ready = false;
  }
});

describe('写操作预校验（需要测试库的请假配置）', () => {
  it('拒绝数字 type / 别名，返回真实可用类型', async () => {
    if (!ready) return;
    const r = await preflight.validate({ tool, args: { type: 2, start_time: ymd(1) + ' 13:00:00', end_time: ymd(1) + ' 13:30:00', reason: '病假' } });
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe('INVALID_LEAVE_TYPE');
    expect(r.error.allowed_types).toContain('午集合');
    expect(r.error.windows).toContain('午集合 13:00-14:00');
  });

  it('拒绝已经过期的日期（不静默提交 9/13 这种历史日期）', async () => {
    if (!ready) return;
    const r = await preflight.validate({ tool, args: { type: '午集合', start_time: ymd(-1) + ' 13:00:00', end_time: ymd(-1) + ' 13:30:00', reason: '病假' } });
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe('LEAVE_EXPIRED');
    expect(r.error.today).toBeTruthy();
  });

  it('固定类型必须同日且落在真实窗口内', async () => {
    if (!ready) return;
    const outside = await preflight.validate({ tool, args: { type: '午集合', start_time: ymd(1) + ' 14:00:00', end_time: ymd(1) + ' 14:30:00', reason: '病假' } });
    expect(outside.ok).toBe(false);
    expect(outside.error.code).toBe('LEAVE_OUTSIDE_WINDOW');

    const crossDay = await preflight.validate({ tool, args: { type: '午集合', start_time: ymd(1) + ' 13:30:00', end_time: ymd(2) + ' 13:30:00', reason: '病假' } });
    expect(crossDay.ok).toBe(false);
    expect(crossDay.error.code).toBe('LEAVE_OUTSIDE_WINDOW');

    const ok = await preflight.validate({ tool, args: { type: '午集合', start_time: ymd(1) + ' 13:00:00', end_time: ymd(1) + ' 13:30:00', reason: '病假' } });
    expect(ok.ok).toBe(true);
    expect(ok.configHash).toMatch(/^[a-f0-9]{64}$/);
    expect(ok.paramsHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('拒绝反向区间、超过 30 天、空事由', async () => {
    if (!ready) return;
    const reverse = await preflight.validate({ tool, args: { type: '其他', start_time: ymd(2) + ' 10:00:00', end_time: ymd(1) + ' 10:00:00', reason: 'x' } });
    expect(reverse.error.code).toBe('INVALID_RANGE');

    const tooLong = await preflight.validate({ tool, args: { type: '其他', start_time: ymd(1) + ' 00:00:00', end_time: ymd(40) + ' 00:00:00', reason: 'x' } });
    expect(tooLong.error.code).toBe('LEAVE_TOO_LONG');

    const noReason = await preflight.validate({ tool, args: { type: '其他', start_time: ymd(1) + ' 10:00:00', end_time: ymd(1) + ' 11:00:00', reason: '  ' } });
    expect(noReason.error.code).toBe('MISSING_REASON');
  });

  it('附件只能来自本轮或当前草稿', async () => {
    if (!ready) return;
    const base = { type: '其他', start_time: ymd(1) + ' 10:00:00', end_time: ymd(1) + ' 11:00:00', reason: 'x' };
    const ok = await preflight.validate({
      tool, args: { ...base, attachments: ['/uploads/agent/current.png'] },
      allowedAttachmentUrls: new Set(['/uploads/agent/current.png'])
    });
    expect(ok.ok).toBe(true);

    const bad = await preflight.validate({
      tool, args: { ...base, attachments: ['/uploads/agent/old-leave.png'] },
      allowedAttachmentUrls: new Set(['/uploads/agent/current.png'])
    });
    expect(bad.ok).toBe(false);
    expect(bad.error.code).toBe('ATTACHMENT_NOT_CURRENT');
  });

  it('销假/审批校验 id 与状态枚举', async () => {
    if (!ready) return;
    const cancelTool = { name: 'cancel_leave', kind: 'curated', method: 'PUT', path: '/api/leave/cancel/{id}', pathParams: ['id'] };
    expect((await preflight.validate({ tool: cancelTool, args: { id: 0 } })).error.code).toBe('INVALID_ID');
    expect((await preflight.validate({ tool: cancelTool, args: { id: 'abc' } })).error.code).toBe('INVALID_ID');
    expect((await preflight.validate({ tool: cancelTool, args: { id: '12' } })).ok).toBe(true);

    const approveTool = { name: 'approve_leave', kind: 'curated', method: 'PUT', path: '/api/leave/approve' };
    expect((await preflight.validate({ tool: approveTool, args: { id: 12, status: 3 } })).error.code).toBe('INVALID_STATUS');
    expect((await preflight.validate({ tool: approveTool, args: { id: 12, status: '2' } })).ok).toBe(true);
  });

  it('动态配置哈希稳定，参数哈希与键顺序无关', async () => {
    if (!ready) return;
    const a = await preflight.loadLeaveConfig(true);
    const b = await preflight.loadLeaveConfig(true);
    expect(a.hash).toBe(b.hash);
    expect(preflight.paramsHash({ a: 1, b: 2 })).toBe(preflight.paramsHash({ b: 2, a: 1 }));
    expect(preflight.paramsHash({ a: 1 })).not.toBe(preflight.paramsHash({ a: 2 }));
  });
});
