import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'x';
process.env.JWT_SECRET = 'test_secret_1234567';

let catalog;
let buildMcpTools;
beforeAll(() => {
  const app = require('../../app');
  const { buildTools } = require('../../services/agent/toolCatalog');
  buildMcpTools = require('../../services/mcp/mcpTools').buildMcpTools;
  catalog = buildTools(app);
});

describe('MCP 工具映射', () => {
  it('默认只读：不含写操作工具', () => {
    const ro = buildMcpTools(catalog, { allowWrite: false });
    const names = ro.map((t) => t.name);
    expect(names).toContain('cm_my_leaves');
    expect(names).not.toContain('cm_apply_leave');
    expect(names).not.toContain('cm_submit_suggestion');
    expect(names).not.toContain('cm_approve_leave');
  });

  it('开启写操作后包含写类工具', () => {
    const rw = buildMcpTools(catalog, { allowWrite: true });
    const names = rw.map((t) => t.name);
    expect(names).toContain('cm_apply_leave');
    expect(names).toContain('cm_submit_suggestion');
    expect(rw.length).toBeGreaterThan(buildMcpTools(catalog, { allowWrite: false }).length);
  });

  it('只读模式下模块工具仅保留 GET action', () => {
    const ro = buildMcpTools(catalog, { allowWrite: false });
    const leave = ro.find((t) => t.name === 'cm_leave');
    expect(leave).toBeTruthy();
    const actions = leave.shape.action.options;
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) expect(a.startsWith('GET ')).toBe(true);
  });

  it('全部工具名带 cm_ 前缀且不暴露 agent 自身接口', () => {
    const rw = buildMcpTools(catalog, { allowWrite: true });
    for (const t of rw) {
      expect(t.name.startsWith('cm_')).toBe(true);
      expect(t.name).not.toContain('agent');
    }
    expect(rw.some((t) => t.name === 'cm_system_guide')).toBe(true);
  });
});
