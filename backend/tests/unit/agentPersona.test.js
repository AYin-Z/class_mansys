import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { buildSystemPrompt } = require('../../services/agent/persona');

describe('角色化提示词', () => {
  it('干部：管理助手定位 + 管理能力清单', () => {
    const p = buildSystemPrompt({ name: '队长', role: 1 });
    expect(p).toContain('管理助手');
    expect(p).toContain('审批');
    expect(p).toContain('中队出勤');
    expect(p).toContain('逐条确认');
  });

  it('学员：使用引导定位 + 引导工具提示', () => {
    const p = buildSystemPrompt({ name: '学员', role: 0 });
    expect(p).toContain('使用引导');
    expect(p).toContain('system_guide');
    expect(p).toContain('需要我直接帮你提交吗');
  });

  it('辅导员(9) 视为干部', () => {
    expect(buildSystemPrompt({ role: 9 })).toContain('管理助手');
  });

  it('两种人设都包含写操作两阶段确认规则', () => {
    for (const role of [0, 1, 8]) {
      const p = buildSystemPrompt({ role });
      expect(p).toContain('立刻调用对应写工具');
      expect(p).toContain('确认卡片');
    }
  });
});
