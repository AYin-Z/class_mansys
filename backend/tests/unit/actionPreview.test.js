import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const ap = require('../../services/agent/actionPreview');
const { buildTools } = require('../../services/agent/toolCatalog');

let catalog;
beforeAll(() => { catalog = buildTools(require('../../app')); });

describe('写操作确认卡片：风险分级', () => {
  it('发布通知/公告 → high', () => {
    expect(ap.classify(catalog.byName.get('publish_notice'), {})).toBe('high');
  });

  it('审批 → high', () => {
    expect(ap.classify(catalog.byName.get('approve_leave'), {})).toBe('high');
    expect(ap.classify(catalog.byName.get('approve_expense'), {})).toBe('high');
  });

  it('加/减积分 → high（影响他人且对方可见）', () => {
    expect(ap.classify(catalog.byName.get('add_points'), {})).toBe('high');
  });

  it('只影响自己的低风险操作不值得打断用户', () => {
    expect(ap.classify(catalog.byName.get('submit_suggestion'), {})).toBe('low');
  });

  it('模块工具的 DELETE 一律 high（不可逆）', () => {
    const mod = catalog.tools.find((t) => t.kind === 'module' && t.actions.some((a) => a.startsWith('DELETE ')));
    expect(mod, '需要至少一个带 DELETE 的模块').toBeTruthy();
    const del = mod.actions.find((a) => a.startsWith('DELETE '));
    expect(ap.classify(mod, { action: del })).toBe('high');
  });
});

describe('写操作确认卡片：说人话 + 影响面', () => {
  it('发布通知卡片不出现英文字段名，且带真实影响面', async () => {
    const d = await ap.describe(catalog.byName.get('publish_notice'), {
      title: '明天早上8点集合', content: '请全员准时', type: '通知'
    });
    expect(d.risk).toBe('high');
    expect(d.irreversible).toBe(true);
    expect(d.summary).toContain('明天早上8点集合');
    expect(d.summary).not.toContain('title');
    expect(d.summary).not.toContain('{');
    // 影响面必须由后端查库得出，且说明不可撤回
    expect(d.impact).toMatch(/人/);
    expect(d.impact).toContain('无法撤回');
  });

  it('删除类突出不可逆', async () => {
    const d = await ap.describe({ kind: 'curated', name: 'x', label: '删除相册', method: 'DELETE' }, { id: 7 });
    expect(d.risk).toBe('high');
    expect(d.irreversible).toBe(true);
    expect(d.impact).toContain('无法恢复');
  });

  it('积分卡片说清给谁加多少分', async () => {
    const d = await ap.describe(catalog.byName.get('add_points'), { user_id: 3, score: -2, reason: '迟到' });
    expect(d.summary).toContain('#3');
    expect(d.summary).toContain('扣 2');
    expect(d.impact).toContain('迟到');
  });

  it('普通卡片用中文业务字段名，不暴露 JSON', async () => {
    const d = await ap.describe(catalog.byName.get('apply_leave'), {
      type: '早操', start_time: '2026-09-13 06:00:00', end_time: '2026-09-13 06:30:00', reason: '病假'
    });
    expect(d.summary).toContain('类型：早操');
    expect(d.summary).not.toContain('start_time');
    expect(d.summary).not.toContain('{');
  });

  it('卡片文案一律不超长（给人扫一眼，不是给人读全文）', async () => {
    const d = await ap.describe(catalog.byName.get('publish_notice'), { title: 'x'.repeat(300), content: 'y'.repeat(300) });
    expect(d.summary.length).toBeLessThanOrEqual(120);
    expect(d.impact.length).toBeLessThanOrEqual(255);
  });
});
