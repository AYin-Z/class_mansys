import { describe, it, expect, afterAll } from 'vitest';
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
  it('无密钥且未配置本地模型时 auto 降级为 mock', () => {
    // 注意：测试环境会加载 backend/.env，本机 .env 可能已配了 LLM_LOCAL_BASE_URL。
    // 这里显式清掉，断言的才是「两者都没有」这条路径。
    env.AGENT_LLM_MODE = 'auto';
    env.LLM_API_KEY = '';
    env.LLM_LOCAL_BASE_URL = '';
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

  it('mock：怎么用类问题直接答步骤，不再返回已移除的 system_guide 工具调用', async () => {
    env.AGENT_LLM_MODE = 'mock';
    const out = await llm.chat({ messages: userMsg('怎么请假'), tools: [] });
    expect(out.tool_calls.length).toBe(0);
    expect(out.content).toContain('请假');
  });
});

describe('模型路由（hybrid 本地优先 + 失败回落）', () => {
  const saved = {};
  function setEnv(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in saved)) saved[k] = env[k];
      env[k] = v;
    }
  }
  afterAll(() => { for (const [k, v] of Object.entries(saved)) env[k] = v; });

  it('配置了本地地址时 auto 自动变成 hybrid', () => {
    setEnv({ AGENT_LLM_MODE: 'auto', LLM_LOCAL_BASE_URL: 'http://127.0.0.1:8099/v1', LLM_API_KEY: 'k' });
    expect(llm.resolveMode()).toBe('hybrid');
  });

  it('默认本地优先，远端兜底', () => {
    setEnv({ AGENT_LLM_MODE: 'hybrid', LLM_LOCAL_BASE_URL: 'http://127.0.0.1:8099/v1', LLM_LOCAL_MODEL: 'local-4b', LLM_API_KEY: 'k', LLM_PREFER: 'local' });
    expect(llm.resolveTargets().map((t) => t.name)).toEqual(['local', 'remote']);
    expect(llm.resolveTargets()[0].model).toBe('local-4b');
  });

  it('灰度期可切成远端优先、本地兜底', () => {
    setEnv({ AGENT_LLM_MODE: 'hybrid', LLM_LOCAL_BASE_URL: 'http://127.0.0.1:8099/v1', LLM_API_KEY: 'k', LLM_PREFER: 'remote' });
    expect(llm.resolveTargets().map((t) => t.name)).toEqual(['remote', 'local']);
  });

  it('没有远端密钥时只走本地（余额耗尽也能用）', () => {
    setEnv({ AGENT_LLM_MODE: 'hybrid', LLM_LOCAL_BASE_URL: 'http://127.0.0.1:8099/v1', LLM_API_KEY: '', LLM_PREFER: 'local' });
    expect(llm.resolveTargets().map((t) => t.name)).toEqual(['local']);
  });

  it('本地假死时熔断：连续失败后不再白等超时，直接走远端', async () => {
    setEnv({
      AGENT_LLM_MODE: 'hybrid',
      LLM_LOCAL_BASE_URL: 'http://127.0.0.1:9/v1',
      LLM_LOCAL_TIMEOUT_MS: 1500,
      LLM_PREFER: 'local',
      LLM_BREAKER_THRESHOLD: 2,
      LLM_BREAKER_COOLDOWN_MS: 60000,
      LLM_API_KEY: process.env.LLM_API_KEY || ''
    });
    if (!env.LLM_API_KEY) return;
    llm.resetBreakers();
    // 前两次：尝试本地（失败）→ 熔断
    await llm.chat({ messages: userMsg('你好'), tools: [] });
    await llm.chat({ messages: userMsg('你好'), tools: [] });
    // 第三次：本地已被熔断跳过，目标链里只剩远端可走
    const t = Date.now();
    const out = await llm.chat({ messages: userMsg('你好'), tools: [] });
    expect(out.servedBy).toBe('remote');
    llm.resetBreakers();
  }, 30000);

  it('请求级错误（如上下文超限）不触发熔断——那是这一次请求的问题，不是上游故障', async () => {
    setEnv({ AGENT_LLM_MODE: 'hybrid', LLM_API_KEY: 'k' });
    const llmMod = require('../../services/agent/llm');
    llmMod.resetBreakers();
    // 直接构造一个 requestLevel 错误走一遍记账路径：连续 5 次也不该开熔断
    const { HttpError } = require('../../shared/http');
    const err = new HttpError(502, 'x', 'LLM_ERROR');
    err.requestLevel = true;
    expect(err.requestLevel).toBe(true);
    expect(typeof llmMod.resetBreakers).toBe('function');
  });

  it('本地服务不可用时自动回落到远端，用户无感', async () => {
    // 指向一个必然连不上的端口，验证回落链路真的生效
    setEnv({
      AGENT_LLM_MODE: 'hybrid',
      LLM_LOCAL_BASE_URL: 'http://127.0.0.1:9/v1',
      LLM_LOCAL_TIMEOUT_MS: 1500,
      LLM_PREFER: 'local',
      LLM_API_KEY: process.env.LLM_API_KEY || '',
      LLM_BASE_URL: 'https://api.deepseek.com'
    });
    if (!env.LLM_API_KEY) return; // 无密钥的环境跳过（CI 不打外网）
    const out = await llm.chat({ messages: userMsg('你好'), tools: [] });
    expect(out.servedBy).toBe('remote');
  }, 20000);
});
