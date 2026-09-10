import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

let catalog;
beforeAll(() => {
  const app = require('../../app');
  const { buildTools, toOpenAiTools } = require('../../services/agent/toolCatalog');
  catalog = buildTools(app);
  catalog.openai = toOpenAiTools(catalog);
});

describe('Agent 工具目录', () => {
  it('由路由表生成，覆盖全部业务模块端点', () => {
    expect(catalog.routeCount).toBeGreaterThan(100);
    expect(catalog.tools.length).toBeGreaterThan(30);
  });

  it('每个模块都有一个模块工具，action 均为真实端点', () => {
    const modules = catalog.tools.filter((t) => t.kind === 'module');
    expect(modules.length).toBeGreaterThanOrEqual(18);
    for (const m of modules) {
      expect(m.actions.length).toBeGreaterThan(0);
      for (const a of m.actions) expect(a).toMatch(/^(GET|POST|PUT|DELETE) \//);
    }
  });

  it('不暴露 agent 自身接口', () => {
    expect(catalog.tools.some((t) => t.module === '/api/agent')).toBe(false);
    for (const t of catalog.tools) {
      if (t.kind === 'module') {
        for (const a of t.actions) expect(a).not.toContain('/api/agent');
      } else if (t.path) {
        expect(t.path).not.toContain('/api/agent');
      }
    }
  });

  it('快捷工具覆盖高频流程，且写操作被正确标记', () => {
    for (const name of ['my_leaves', 'apply_leave', 'create_expense', 'submit_suggestion', 'company_attendance']) {
      expect(catalog.byName.has(name), name).toBe(true);
    }
    expect(catalog.byName.get('apply_leave').write).toBe(true);
    expect(catalog.byName.get('submit_suggestion').write).toBe(true);
    expect(catalog.byName.get('my_leaves').write).toBe(false);
  });

  it('带路径参数的快捷工具能匹配到真实路由(:id)', () => {
    expect(catalog.byName.get('cancel_leave').path).toBe('/api/leave/cancel/{id}');
    expect(catalog.byName.get('notice_detail').path).toBe('/api/notice/{id}');
  });

  it('本地工具（使用引导）带 handler 且不写库', () => {
    const local = catalog.tools.filter((t) => t.kind === 'local');
    expect(local.length).toBeGreaterThanOrEqual(1);
    for (const t of local) {
      expect(typeof t.handler).toBe('function');
      expect(t.write).toBe(false);
    }
  });

  it('OpenAI 工具格式合法', () => {
    expect(catalog.openai.length).toBe(catalog.tools.length);
    for (const t of catalog.openai) {
      expect(t.type).toBe('function');
      expect(typeof t.function.name).toBe('string');
      expect(t.function.parameters.type).toBe('object');
    }
    const applyLeave = catalog.openai.find((t) => t.function.name === 'apply_leave');
    expect(applyLeave.function.parameters.required).toContain('start_time');
  });
});
