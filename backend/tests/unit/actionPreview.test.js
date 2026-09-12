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
    }, { id: 1, role: 1, class_id: '1' });
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
    const d = await ap.describe(catalog.byName.get('publish_notice'), { title: 'x'.repeat(300), content: 'y'.repeat(300) }, { id: 1, role: 1, class_id: '1' });
    expect(d.summary.length).toBeLessThanOrEqual(120);
    expect(d.impact.length).toBeLessThanOrEqual(255);
  });
});

describe('确认策略：降噪（不是所有写操作都值得打断）', () => {
  it('低风险直接办，不回卡片', () => {
    expect(ap.policyFor('low')).toBe('auto');
  });

  it('中风险回卡片，不加额外摩擦', () => {
    expect(ap.policyFor('medium')).toBe('confirm');
  });

  it('高风险回卡片且加摩擦（App 勾选 / 微信短码）', () => {
    expect(ap.policyFor('high')).toBe('strict');
  });

  it('发布通知走 strict，提交建议走 auto', async () => {
    const notice = await ap.describe(catalog.byName.get('publish_notice'), { title: 'x', content: 'y' }, { id: 1, role: 1, class_id: '1' });
    const sugg = await ap.describe(catalog.byName.get('submit_suggestion'), { content: '食堂排队太久' });
    expect(notice.policy).toBe('strict');
    expect(sugg.policy).toBe('auto');
  });
});

describe('通知影响面必须按作者作用域算（不能想当然写全中队）', () => {
  it('区队干部发的通知只有本区队可见', async () => {
    const d = await ap.describe(
      catalog.byName.get('publish_notice'),
      { title: '集合', content: '明天早上8点集合' },
      { id: 1, role: 1, class_id: '1' }
    );
    // 通知归属由服务端按作者作用域盖章（stampClassId），区队干部 → 本区队
    expect(d.impact).toContain('本区队');
    expect(d.impact).not.toContain('全中队');
  });

  it('超管发布是全局可见', async () => {
    const d = await ap.describe(
      catalog.byName.get('publish_notice'),
      { title: '集合', content: '明天早上8点集合' },
      { id: 8, role: 8, class_id: '1' }
    );
    expect(d.impact).toContain('全中队');
  });
});

describe('通知可见范围选项', () => {
  it('显式要全中队时，影响面按全中队算', async () => {
    const d = await ap.describe(
      catalog.byName.get('publish_notice'),
      { title: '集合', content: '明天早上8点集合', audience: 'company' },
      { id: 5, role: 5, class_id: '6' }
    );
    expect(d.impact).toContain('全中队');
  });

  it('不传范围时按作者作用域（区队干部 → 本区队）', async () => {
    const d = await ap.describe(
      catalog.byName.get('publish_notice'),
      { title: '集合', content: '明天早上8点集合' },
      { id: 1, role: 1, class_id: '6' }
    );
    expect(d.impact).toContain('本区队');
  });

  it('工具表暴露了 audience，模型才知道有这个选项', () => {
    const t = catalog.byName.get('publish_notice');
    expect(t.body).toContain('audience');
  });

  it('权限矩阵里只有团支书/宣传委员/超管/辅导员能发全中队', () => {
    const perms = require('../../shared/permissions');
    const roles = perms.PERMISSIONS.PUBLISH_NOTICE_COMPANY;
    expect(roles).toEqual([5, 7, 8, 9]);
    expect(roles).not.toContain(1); // 区队长默认不能向全中队群发
  });
});
