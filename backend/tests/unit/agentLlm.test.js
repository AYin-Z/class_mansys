import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { env } = require('../../config/env');
const llm = require('../../services/agent/llm');

function userMsg(text) { return [{ role: 'user', content: text }]; }
function toolName(out) {
  const c = out.tool_calls && out.tool_calls[0];
  return c && c.function && c.function.name;
}

describe('LLM 客户端（mock/off 模式）', () => {
  it('无密钥时 auto 模式降级为 mock', () => {
    env.AGENT_LLM_MODE = 'auto';
    env.LLM_API_KEY = '';
    expect(llm.resolveMode()).toBe('mock');
  });

  it('off 模式直接 503', async () => {
    env.AGENT_LLM_MODE = 'off';
    await expect(llm.chat({ messages: userMsg('你好'), tools: [] })).rejects.toMatchObject({ status: 503 });
    env.AGENT_LLM_MODE = 'auto';
  });

  it('mock：读意图映射到对应工具', async () => {
    env.AGENT_LLM_MODE = 'mock';
    expect(toolName(await llm.chat({ messages: userMsg('我的请假记录'), tools: [] }))).toBe('my_leaves');
    expect(toolName(await llm.chat({ messages: userMsg('有什么通知'), tools: [] }))).toBe('list_notices');
    expect(toolName(await llm.chat({ messages: userMsg('我们中队今天出勤怎么样'), tools: [] }))).toBe('company_attendance');
  });

  it('mock：写意图（建议）映射到 submit_suggestion 并带上内容', async () => {
    env.AGENT_LLM_MODE = 'mock';
    const out = await llm.chat({ messages: userMsg('建议：希望食堂多开一个窗口'), tools: [] });
    const call = out.tool_calls[0];
    expect(call.function.name).toBe('submit_suggestion');
    expect(JSON.parse(call.function.arguments).content).toContain('食堂');
  });

  it('mock：工具结果返回后给出总结而不重复调用', async () => {
    env.AGENT_LLM_MODE = 'mock';
    const messages = [{ role: 'user', content: '我的请假' }, { role: 'tool', content: '{}' }];
    const out = await llm.chat({ messages, tools: [] });
    expect(out.tool_calls.length).toBe(0);
    expect(out.content.length).toBeGreaterThan(0);
  });
});
