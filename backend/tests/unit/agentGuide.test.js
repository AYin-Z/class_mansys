import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { systemGuide, GUIDES } = require('../../services/agent/guide');

describe('系统使用引导（本地工具）', () => {
  it('按主题返回权威步骤与页面路径', () => {
    const r = systemGuide({ topic: '请假' });
    expect(r.found).toBe(true);
    expect(r.steps.length).toBeGreaterThanOrEqual(3);
    expect(r.pages.join(',')).toContain('/pages/leave/');
  });

  it('支持模糊匹配（如「怎么请假」→ 请假）', () => {
    const r = systemGuide({ topic: '怎么请假' });
    expect(r.topic).toBe('请假');
  });

  it('未知主题返回可选主题列表', () => {
    const r = systemGuide({ topic: '不存在的功能' });
    expect(r.found).toBe(false);
    expect(r.topics.length).toBeGreaterThan(5);
  });

  it('不传主题时列出全部主题', () => {
    const r = systemGuide({});
    expect(r.topics).toEqual(Object.keys(GUIDES));
  });

  it('覆盖核心模块', () => {
    for (const t of ['请假', '班费', '建议箱', '作业', '通知公告', '积分', '心理', '中队出勤']) {
      expect(GUIDES[t], t).toBeTruthy();
    }
  });
});
