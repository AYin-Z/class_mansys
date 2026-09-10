const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { HttpError } = require('../../shared/http');

/** 运行模式：live=真实模型；mock=规则匹配（无密钥/离线/测试）；off=关闭 */
function resolveMode() {
  if (env.AGENT_LLM_MODE === 'off') return 'off';
  if (env.AGENT_LLM_MODE === 'mock') return 'mock';
  if (env.AGENT_LLM_MODE === 'live') return env.LLM_API_KEY ? 'live' : 'mock';
  return env.LLM_API_KEY ? 'live' : 'mock';
}

async function chat({ messages, tools }) {
  const mode = resolveMode();
  if (mode === 'off') {
    throw new HttpError(503, '对话助手未启用（AGENT_LLM_MODE=off）', 'AGENT_DISABLED');
  }
  if (mode === 'mock') {
    return mockChat(messages);
  }

  const url = String(env.LLM_BASE_URL).replace(/\/+$/, '') + '/chat/completions';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.LLM_API_KEY
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
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
      logger.warn({ status: res.status, body: text.slice(0, 300) }, 'llm request failed');
      throw new HttpError(502, '模型服务暂时不可用，请稍后再试', 'LLM_ERROR');
    }
    const data = await res.json();
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    return { content: msg.content || '', tool_calls: msg.tool_calls || [], usage: data.usage || null };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    logger.warn({ err: e }, 'llm request error');
    throw new HttpError(502, '模型服务请求失败，请稍后再试', 'LLM_ERROR');
  } finally {
    clearTimeout(timer);
  }
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
  if (guideMatch) return call('system_guide', { topic: guideMatch[1].replace('交作业', '作业').replace('报班费', '班费').replace('交班费', '班费').replace('提建议', '建议箱').replace('看通知', '通知公告').replace('看公告', '通知公告').replace('看积分', '积分').replace('做心理', '心理').replace('看相册', '相册').replace('改密码', '账号').replace('销假', '请假') });
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
async function chatStream({ messages, tools, onDelta }) {
  const mode = resolveMode();
  if (mode === 'off') throw new HttpError(503, '对话助手未启用（AGENT_LLM_MODE=off）', 'AGENT_DISABLED');
  if (mode === 'mock') {
    const out = mockChat(messages);
    if (out.content && typeof onDelta === 'function') onDelta(out.content);
    return out;
  }

  const url = String(env.LLM_BASE_URL).replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.LLM_API_KEY },
    body: JSON.stringify({ model: env.LLM_MODEL, messages, tools, tool_choice: 'auto', temperature: 0.2, stream: true })
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    logger.warn({ status: res.status, body: text.slice(0, 200) }, 'llm stream failed');
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

  return { content, tool_calls: toolCalls.filter(Boolean) };
}

module.exports = { chat, chatStream, resolveMode };
