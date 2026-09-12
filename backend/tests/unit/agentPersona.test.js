import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { buildSystemPrompt, buildUserContext } = require('../../services/agent/persona');

describe('角色化提示词', () => {
  it('干部：管理助手定位 + 管理能力清单', () => {
    const p = buildSystemPrompt({ name: '队长', role: 1 });
    expect(p).toContain('管理助手');
    expect(p).toContain('审批');
    expect(p).toContain('中队出勤');
    expect(p).toContain('逐条确认');
  });

  it('学员：使用引导定位 + 内联操作路径（不再依赖 system_guide 工具）', () => {
    const p = buildSystemPrompt({ name: '学员', role: 0 });
    expect(p).toContain('使用引导');
    expect(p).toContain('需要我直接帮你提交吗');
    // 操作路径改为内联进 prompt：以前靠 system_guide 工具，每次多一轮 LLM 往返，
    // 且小模型会把「帮我请假」误判成「怎么请假」去调它（实测 4/5 → 5/5）。
    expect(p).toContain('【各功能操作路径】');
    expect(p).toContain('/pages/leave/index');
    expect(p).not.toContain('system_guide');
  });

  it('两种人设都包含「怎么办 vs 帮我办」消歧规则', () => {
    for (const role of [0, 1, 9]) {
      const p = buildSystemPrompt({ role });
      expect(p).toContain('区分「怎么办」和「帮我办」');
      expect(p).toContain('立刻调用对应工具');
    }
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

describe('system prompt 必须保持静态（前缀缓存的命门）', () => {
  it('不同用户的 system prompt 完全一致——否则前缀缓存整体失效', () => {
    // 实测（12 个不同用户 / 12 并发 / 冷缓存）：
    //   用户名写进 system prompt → 墙钟 25.9s，吞吐 0.46 req/s，缓存命中 0%
    //   静态 system prompt      → 墙钟  1.4s，吞吐 8.84 req/s，缓存命中 99%
    // 前缀缓存只能从第一个 token 开始匹配，名字在最前面 → 后面 8000 多 token 的工具表全废。
    const a = buildSystemPrompt({ name: '张三', role: 0 });
    const b = buildSystemPrompt({ name: '李四', role: 0 });
    expect(a).toBe(b);
    expect(a).not.toContain('张三');
    expect(a).not.toContain('李四');
  });

  it('同一天的学员之间不因日期分叉（日期也不许进 system prompt）', () => {
    expect(buildSystemPrompt({ role: 0 })).toBe(buildSystemPrompt({ role: 0 }));
  });

  it('角色大类仍然分叉（学员 / 干部 两组静态文本）', () => {
    expect(buildSystemPrompt({ role: 0 })).not.toBe(buildSystemPrompt({ role: 1 }));
  });

  it('用户身份改由 buildUserContext 携带', () => {
    const c = buildUserContext({ name: '张三', role: 1 });
    expect(c).toContain('张三');
    expect(c).toContain('role=1');
    expect(c).toContain('区队长');
    expect(c).toMatch(/今天 \d{4}-\d{2}-\d{2}/);
  });
});
