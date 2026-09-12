/**
 * 本地模型预热（P1 鲁棒性）
 *
 * 为什么需要：llama.cpp 的前缀缓存只在**有请求走过这段前缀之后**才存在。
 * 实测（12 并发、冷缓存）12 个不同用户要 25.9s；一旦前缀进了缓存就只要 1.4s。
 * 所以"第一次用很卡"本质是冷缓存，而不是模型慢。
 *
 * 做法：用**与真实请求完全相同的 system prompt + 工具表**发一个最小请求
 * （max_tokens=1，几乎不产生生成开销），把这段公共前缀灌进缓存。
 *
 * 关键约束：预热内容必须与真实请求逐 token 一致，否则等于白热。
 * 所以这里直接复用 agentCatalogFor（按角色缓存的那一份）和 buildSystemPrompt（静态的），
 * 而不是自己拼一份"差不多"的 prompt。
 */
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { buildSystemPrompt } = require('./persona');
const { toOpenAiTools } = require('./toolCatalog');
const llm = require('./llm');

/** 预热哪些角色（学员 + 干部 = 两组静态 prompt；再多的角色不影响前缀） */
const WARM_ROLES = [0, 1];

let timer = null;
let stopped = false;

async function warmOnce(app, agentCatalogFor) {
  const targets = llm.resolveTargets();
  const local = targets.find((t) => t.name === 'local');
  if (!local) return { skipped: 'no-local-target' };

  const results = [];
  for (const role of WARM_ROLES) {
    try {
      const tools = toOpenAiTools(agentCatalogFor(app, { role }));
      const body = JSON.stringify({
        model: local.model,
        messages: [
          { role: 'system', content: buildSystemPrompt({ role }) },
          { role: 'user', content: '（预热）' }
        ],
        tools,
        tool_choice: 'auto',
        max_tokens: 1,
        temperature: 0
      });
      const startedAt = Date.now();
      const res = await fetch(local.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + local.apiKey },
        body,
        signal: AbortSignal.timeout ? AbortSignal.timeout(local.timeoutMs) : undefined
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json().catch(() => ({}));
      const cached = ((data.usage || {}).prompt_tokens_details || {}).cached_tokens || 0;
      const prompt = (data.usage || {}).prompt_tokens || 0;
      results.push({ role, ms: Date.now() - startedAt, prompt, cached });
    } catch (e) {
      results.push({ role, error: (e && e.message) || 'unknown' });
    }
  }
  return { results };
}

/**
 * 启动定时预热。由 app.js 调用；环境变量 LLM_WARMUP_INTERVAL_MS=0 可关闭。
 * 用 unref() 让定时器不阻塞进程退出。
 */
function startWarmup(app, agentCatalogFor) {
  const intervalMs = Number(env.LLM_WARMUP_INTERVAL_MS) || 0;
  if (intervalMs <= 0) {
    logger.info('本地模型预热已关闭（LLM_WARMUP_INTERVAL_MS=0）');
    return null;
  }
  if (llm.resolveMode() !== 'hybrid') {
    logger.info({ mode: llm.resolveMode() }, '非 hybrid 模式，跳过本地模型预热');
    return null;
  }

  const tick = async () => {
    if (stopped) return;
    try {
      const r = await warmOnce(app, agentCatalogFor);
      if (r && r.results) {
        logger.info({ results: r.results }, '本地模型预热完成');
      }
    } catch (e) {
      logger.warn({ err: e && e.message }, '本地模型预热失败（不影响对话）');
    }
  };

  // 启动后先热一次（等模型加载完；llama-server 冷启动要 30~40s，所以延迟一点重试）
  setTimeout(tick, 8000).unref();
  timer = setInterval(tick, intervalMs);
  timer.unref();
  logger.info({ intervalMs }, '本地模型预热已启动');
  return timer;
}

function stopWarmup() {
  stopped = true;
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startWarmup, stopWarmup, warmOnce, WARM_ROLES };
