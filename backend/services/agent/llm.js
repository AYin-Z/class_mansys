const { env } = require('../../config/env');
const { GUIDES } = require('./guide');
const logger = require('../../config/logger');
const { HttpError } = require('../../shared/http');

/**
 * 运行模式：
 * - off / mock：关闭 / 规则匹配（无密钥、离线、测试）
 * - live：只走远端 API（DeepSeek）
 * - hybrid：**先走本地模型，失败或超时再回落远端**（省钱 + 远端余额耗尽时仍然可用）
 * - auto：配置了本地地址就 hybrid，否则有 key 走 live、没 key 走 mock
 */
function resolveMode() {
  if (env.AGENT_LLM_MODE === 'off') return 'off';
  if (env.AGENT_LLM_MODE === 'mock') return 'mock';
  if (env.AGENT_LLM_MODE === 'live') return env.LLM_API_KEY ? 'live' : 'mock';
  if (env.AGENT_LLM_MODE === 'hybrid') return env.LLM_LOCAL_BASE_URL ? 'hybrid' : 'live';
  // auto
  if (env.LLM_LOCAL_BASE_URL) return 'hybrid';
  return env.LLM_API_KEY ? 'live' : 'mock';
}

function trimUrl(u) { return String(u || '').replace(/\/+$/, ''); }

/**
 * 上游熔断器（每进程内存态）
 *
 * 为什么需要：hybrid 下如果本地 llama-server 假死（进程在、但不返回），
 * 每个请求都要先白等满 LLM_LOCAL_TIMEOUT_MS 才回落，用户体验比直接走远端还差。
 * 连续失败到阈值就临时跳过它，冷却期后再放一个请求去探活（半开）。
 */
const BREAKER_THRESHOLD = Number(env.LLM_BREAKER_THRESHOLD || 3);
const BREAKER_COOLDOWN_MS = Number(env.LLM_BREAKER_COOLDOWN_MS || 60000);
const breakers = new Map();

function breakerOf(name) {
  if (!breakers.has(name)) breakers.set(name, { fails: 0, openedAt: 0 });
  return breakers.get(name);
}

function breakerAllows(name) {
  const b = breakerOf(name);
  if (!b.openedAt) return true;
  if (Date.now() - b.openedAt >= BREAKER_COOLDOWN_MS) {
    b.openedAt = 0; // 半开：放一个请求去探活
    return true;
  }
  return false;
}

function breakerOnSuccess(name) {
  const b = breakerOf(name);
  b.fails = 0;
  b.openedAt = 0;
}

function breakerOnFailure(name) {
  const b = breakerOf(name);
  b.fails += 1;
  if (b.fails >= BREAKER_THRESHOLD && !b.openedAt) {
    b.openedAt = Date.now();
    logger.warn({ target: name, fails: b.fails }, 'llm target breaker opened');
  }
}

/** 仅测试用：重置熔断状态 */
function resetBreakers() { breakers.clear(); }

/**
 * 解析要调用的上游：targets[0] 优先，失败按序回落。
 * 本地模型（llama-server）不校验 Authorization，随便给个占位即可。
 */
function resolveTargets() {
  const remote = {
    name: 'remote',
    baseUrl: trimUrl(env.LLM_BASE_URL),
    model: env.LLM_MODEL,
    apiKey: env.LLM_API_KEY,
    timeoutMs: env.LLM_TIMEOUT_MS,
    available: !!env.LLM_API_KEY
  };
  const local = env.LLM_LOCAL_BASE_URL
    ? {
        name: 'local',
        baseUrl: trimUrl(env.LLM_LOCAL_BASE_URL),
        model: env.LLM_LOCAL_MODEL || env.LLM_MODEL || 'local',
        apiKey: env.LLM_API_KEY || 'local',
        timeoutMs: env.LLM_LOCAL_TIMEOUT_MS,
        available: true
      }
    : null;

  if (resolveMode() === 'hybrid') {
    const targets = [];
    // 灰度期可以先用 remote 优先：远端不动（零质量风险），本地只作兜底，
    // 等本地准确率观察够了再把 LLM_PREFER 切成 local 拿成本收益。
    if (env.LLM_PREFER === 'remote') {
      if (remote.available) targets.push(remote);
      if (local) targets.push(local);
    } else {
      if (local) targets.push(local);
      if (remote.available) targets.push(remote);
    }
    if (targets.length) return targets;
  }
  return remote.baseUrl ? [remote] : [];
}

async function chatOnce(target, { messages, tools }) {
  const url = target.baseUrl + '/chat/completions';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + target.apiKey
      },
      body: JSON.stringify({
        model: target.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        stream: false
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn({ target: target.name, status: res.status, body: text.slice(0, 300) }, 'llm request failed');
      const err = new HttpError(502, '模型服务暂时不可用，请稍后再试', 'LLM_ERROR');
      // 4xx 是这一次请求的问题（最常见的是 prompt 超过该上游的上下文窗口），
      // 不代表上游不健康——不能计入熔断，否则长对话几次超限就会把本地模型整体停掉 60 秒。
      err.requestLevel = res.status >= 400 && res.status < 500;
      throw err;
    }
    const data = await res.json();
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    return {
      content: msg.content || '',
      tool_calls: msg.tool_calls || [],
      usage: data.usage || null,
      servedBy: target.name,
      model: target.model
    };
  } finally {
    clearTimeout(timer);
  }
}

async function chat({ messages, tools }) {
  const mode = resolveMode();
  if (mode === 'off') {
    throw new HttpError(503, '对话助手未启用（AGENT_LLM_MODE=off）', 'AGENT_DISABLED');
  }
  if (mode === 'mock') {
    return mockChat(messages);
  }

  const targets = resolveTargets();
  if (!targets.length) throw new HttpError(502, '未配置模型服务', 'LLM_ERROR');

  let lastErr = null;
  for (const target of targets) {
    if (!breakerAllows(target.name)) {
      logger.warn({ target: target.name }, 'llm target skipped (breaker open)');
      continue;
    }
    try {
      const out = await chatOnce(target, { messages, tools });
      breakerOnSuccess(target.name);
      return out;
    } catch (e) {
      lastErr = e;
      if (!e || !e.requestLevel) breakerOnFailure(target.name);
      // 逐个回落：本地模型挂了/超时 → 自动走远端，用户无感（这是 hybrid 的核心价值：
      // 远端余额耗尽或本地服务重启都不会让对话功能整体不可用）
      logger.warn({ target: target.name, err: e && e.message }, 'llm target failed, falling back');
    }
  }
  throw lastErr instanceof HttpError ? lastErr : new HttpError(502, '模型服务请求失败，请稍后再试', 'LLM_ERROR');
}

/**
 * mock 模式：规则匹配，用于无密钥环境/自动化测试。
 * 只覆盖高频意图；复杂表达请配置 LLM_API_KEY 走真实模型。
 */
function mockChat(messages) {
  const lastTool = [...messages].reverse().find((m) => m.role === 'tool');
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const text = String((lastUser && lastUser.content) || '');

  if (lastTool) {
    return { content: '（mock）已获取到结果，详见上方返回数据。', tool_calls: [] };
  }

  const call = (name, args) => ({
    content: '',
    tool_calls: [{ id: 'mock_' + Date.now(), type: 'function', function: { name, arguments: JSON.stringify(args || {}) } }]
  });

  const guideMatch = text.match(/怎么(请假|销假|交作业|报班费|交班费|提建议|看通知|看公告|看积分|做心理|看相册|投票|抽奖|改密码)/);
  if (guideMatch) {
    // guide 已内联进 system prompt，这里直接照着答，不再造一个 system_guide 工具调用
    // （该工具已从 LLM 工具表移除，返回它会让 toolRunner 找不到工具）
    const topic = guideMatch[1].replace('交作业', '作业').replace('报班费', '班费').replace('交班费', '班费').replace('提建议', '建议箱').replace('看通知', '通知公告').replace('看公告', '通知公告').replace('看积分', '积分').replace('做心理', '心理').replace('看相册', '相册').replace('改密码', '账号').replace('销假', '请假');
    const g = GUIDES[topic];
    if (g) {
      return { content: '（mock）' + topic + '操作步骤：\n' + g.steps.map((st, i) => (i + 1) + '. ' + st).join('\n'), tool_calls: [] };
    }
  }
  if (/待审批|有什么要处理|待办|要审批/.test(text)) return call('pending_leave_approvals', {});
  if (/我的?请假|请假记录|请了几天/.test(text)) return call('my_leaves', {});
  if (/通知|公告/.test(text)) return call('list_notices', {});
  if (/作业/.test(text)) return call('my_homework', {});
  if (/积分|排行|分数/.test(text)) return call('my_points', {});
  if (/出勤|中队|在队|请假情况/.test(text)) return call('company_attendance', {});
  if (/建议|反馈|意见/.test(text)) {
    const content = text.replace(/.*?(建议|反馈|意见)[:：]?/, '').trim();
    if (content.length >= 5) return call('submit_suggestion', { content });
  }
  if (/请假|销假/.test(text)) {
    return {
      content:
        '（mock 模式）我可以帮你提交请假申请。请按「请假：类型=早操 日期=2026-09-12 开始=06:00 结束=06:30 事由=病假」这样的格式告诉我，' +
        '或配置 LLM_API_KEY 后使用自然语言。'
    };
  }

  return {
    content:
      '（mock 模式）我可以帮你办理：请假/销假、班费报销、建议信、通知与作业查询、积分排行、中队出勤概览。' +
      '试试：「我的请假记录」「班费我要报销」「给个建议：……」。'
  };
}

/**
 * 流式对话：live 模式逐 token 回调 onDelta；mock 模式一次性给出内容。
 * 返回与 chat() 相同结构（content + tool_calls）。
 */
async function streamOnce(target, { messages, tools, onDelta }) {
  const url = target.baseUrl + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + target.apiKey },
    body: JSON.stringify({ model: target.model, messages, tools, tool_choice: 'auto', temperature: 0.2, stream: true }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(target.timeoutMs) : undefined
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    logger.warn({ target: target.name, status: res.status, body: text.slice(0, 200) }, 'llm stream failed');
    throw new HttpError(502, '模型服务暂时不可用，请稍后再试', 'LLM_ERROR');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCalls = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let chunk;
      try { chunk = JSON.parse(payload); } catch (e) { continue; }
      const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        if (typeof onDelta === 'function') onDelta(delta.content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const i = typeof tc.index === 'number' ? tc.index : toolCalls.length;
          if (!toolCalls[i]) toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (tc.id) toolCalls[i].id = tc.id;
          if (tc.function) {
            if (tc.function.name) toolCalls[i].function.name += tc.function.name;
            if (tc.function.arguments) toolCalls[i].function.arguments += tc.function.arguments;
          }
        }
      }
    }
  }

  return { content, tool_calls: toolCalls.filter(Boolean), servedBy: target.name, model: target.model };
}

/**
 * 流式对话：逐 token 回调 onDelta。
 *
 * 回落策略与 chat() 不同：**只有在还没吐出任何内容时才允许换上游**。
 * 一旦已经有 token 流给了前端，重试会导致前端看到两段拼在一起的内容——
 * 宁可让这一轮失败，也不要给用户看重复/错乱的回答。
 */
async function chatStream({ messages, tools, onDelta }) {
  const mode = resolveMode();
  if (mode === 'off') throw new HttpError(503, '对话助手未启用（AGENT_LLM_MODE=off）', 'AGENT_DISABLED');
  if (mode === 'mock') {
    const out = mockChat(messages);
    if (out.content && typeof onDelta === 'function') onDelta(out.content);
    return out;
  }

  const targets = resolveTargets();
  if (!targets.length) throw new HttpError(502, '未配置模型服务', 'LLM_ERROR');

  let emitted = false;
  const guardedDelta = (t) => {
    emitted = true;
    if (typeof onDelta === 'function') onDelta(t);
  };

  let lastErr = null;
  for (const target of targets) {
    if (!breakerAllows(target.name)) continue;
    try {
      const out = await streamOnce(target, { messages, tools, onDelta: guardedDelta });
      breakerOnSuccess(target.name);
      return out;
    } catch (e) {
      lastErr = e;
      if (!e || !e.requestLevel) breakerOnFailure(target.name);
      if (emitted) throw e; // 已经吐字了，不能换上游重来
      logger.warn({ target: target.name, err: e && e.message }, 'llm stream target failed, falling back');
    }
  }
  throw lastErr instanceof HttpError ? lastErr : new HttpError(502, '模型服务请求失败，请稍后再试', 'LLM_ERROR');
}

module.exports = { chat, chatStream, resolveMode, resolveTargets, resetBreakers };
