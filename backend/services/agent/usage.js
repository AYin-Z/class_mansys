/**
 * 对话助手用量记账与告警（P0 观测）
 *
 * 解决的问题：本地模型接管后，"它到底替我挡了多少、失败了多少、花了多少"是黑盒。
 * 没有这个数据，容量决策（要不要裁工具、要不要溢出到 API）只能拍脑袋，
 * 而且要等余额烧完才发现本地模型早就挂了。
 *
 * 设计要点：
 * 1. **只落原始 token，成本现算**——价目表会变，记原始数才能重算历史。
 * 2. **记账失败绝不影响对话**——整条链路 try/catch 吞掉，只 warn。
 * 3. 成本只对远端（花钱的）有意义，本地记 0；但仍记 token，便于比较两边行为。
 */
const db = require('../../config/database');
const { env } = require('../../config/env');
const logger = require('../../config/logger');

/**
 * 价目表（人民币元 / 百万 token）
 *
 * 注意：这里只放**能确认**的价格。DeepSeek 的时段折扣与模型换代都会改数，
 * 所以做成 env 可覆盖，并且历史数据可以随时用新价目表重算（我们存了原始 token）。
 * 默认值来源：deepseek-chat 标准价（缓存命中 / 缓存未命中 / 输出）。
 */
function prices() {
  const num = (v, d) => (v === undefined || v === null || v === '' ? d : Number(v));
  return {
    cacheHit: num(env.LLM_PRICE_CACHE_HIT, 0.5),
    cacheMiss: num(env.LLM_PRICE_CACHE_MISS, 2),
    output: num(env.LLM_PRICE_OUTPUT, 8)
  };
}

/** 一次调用的成本（元）。本地/未知上游一律 0。 */
function estimateCost({ servedBy, promptTokens = 0, completionTokens = 0, cacheHitTokens = 0, cacheMissTokens = 0 }) {
  if (servedBy !== 'remote') return 0;
  const p = prices();
  const hit = cacheHitTokens || 0;
  // 有些上游不返回 cache 明细，此时把整个 prompt 按未命中价算（偏保守，不低估成本）
  const miss = cacheMissTokens || Math.max(0, promptTokens - hit);
  const cost = (hit * p.cacheHit + miss * p.cacheMiss + completionTokens * p.output) / 1e6;
  return Math.round(cost * 1e6) / 1e6;
}

/**
 * 记一轮调用。**永不抛错**——记账是旁路，不能因为它把对话搞挂。
 */
async function record(entry) {
  try {
    const e = entry || {};
    const servedBy = String(e.servedBy || 'unknown');
    const usage = e.usage || {};
    const promptTokens = Number(usage.prompt_tokens || usage.promptTokens || 0);
    const completionTokens = Number(usage.completion_tokens || usage.completionTokens || 0);
    const cacheHitTokens = Number(
      usage.prompt_cache_hit_tokens || (usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || 0
    );
    const cacheMissTokens = Number(usage.prompt_cache_miss_tokens || 0);
    const cost = estimateCost({ servedBy, promptTokens, completionTokens, cacheHitTokens, cacheMissTokens });
    await db.query(
      'INSERT INTO agent_usage (user_id, role, conversation_id, step_index, served_by, model, fell_back, streamed,' +
        ' prompt_tokens, completion_tokens, cache_hit_tokens, cache_miss_tokens, cost_cny, latency_ms)' +
        ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        Number(e.userId) || 0,
        Number(e.role) || 0,
        e.conversationId ? Number(e.conversationId) : null,
        Number(e.step) || 0,
        servedBy.slice(0, 16),
        e.model ? String(e.model).slice(0, 96) : null,
        e.fellBack ? 1 : 0,
        e.streamed ? 1 : 0,
        promptTokens,
        completionTokens,
        cacheHitTokens,
        cacheMissTokens,
        cost,
        Math.max(0, Number(e.latencyMs) || 0)
      ]
    );
    return cost;
  } catch (err) {
    logger.warn({ err: err && err.message }, 'agent usage record failed');
    return 0;
  }
}

/** 汇总（默认最近 24 小时） */
async function summary({ sinceHours = 24 } = {}) {
  const [rows] = await db.query(
    'SELECT served_by, COUNT(*) calls, SUM(prompt_tokens) prompt_tokens, SUM(completion_tokens) completion_tokens,' +
      ' SUM(cache_hit_tokens) cache_hit_tokens, SUM(cost_cny) cost_cny, SUM(fell_back) fell_back,' +
      ' AVG(latency_ms) avg_latency_ms, MAX(latency_ms) max_latency_ms' +
      ' FROM agent_usage WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR) GROUP BY served_by',
    [Number(sinceHours) || 24]
  );
  const totals = { calls: 0, costCny: 0, fellBack: 0, promptTokens: 0, completionTokens: 0 };
  const byServed = {};
  for (const r of rows) {
    const calls = Number(r.calls) || 0;
    byServed[r.served_by] = {
      calls,
      promptTokens: Number(r.prompt_tokens) || 0,
      completionTokens: Number(r.completion_tokens) || 0,
      cacheHitTokens: Number(r.cache_hit_tokens) || 0,
      costCny: Number(r.cost_cny) || 0,
      fellBack: Number(r.fell_back) || 0,
      avgLatencyMs: Math.round(Number(r.avg_latency_ms) || 0),
      maxLatencyMs: Number(r.max_latency_ms) || 0
    };
    totals.calls += calls;
    totals.costCny += Number(r.cost_cny) || 0;
    totals.fellBack += Number(r.fell_back) || 0;
    totals.promptTokens += Number(r.prompt_tokens) || 0;
    totals.completionTokens += Number(r.completion_tokens) || 0;
  }
  totals.costCny = Math.round(totals.costCny * 1e6) / 1e6;
  // 回落率 = 本可以走本地却走了远端的比例，是"本地模型健康度"的核心指标
  const fallbackRate = totals.calls ? totals.fellBack / totals.calls : 0;
  return { sinceHours, totals, byServed, fallbackRate };
}

/** 按天汇总（最近 N 天） */
async function daily({ days = 14 } = {}) {
  const [rows] = await db.query(
    'SELECT DATE(created_at) d, served_by, COUNT(*) calls, SUM(cost_cny) cost_cny, SUM(fell_back) fell_back,' +
      ' AVG(latency_ms) avg_latency_ms FROM agent_usage' +
      ' WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY d, served_by ORDER BY d DESC',
    [Number(days) || 14]
  );
  return rows.map((r) => ({
    date: r.d,
    servedBy: r.served_by,
    calls: Number(r.calls) || 0,
    costCny: Math.round((Number(r.cost_cny) || 0) * 1e6) / 1e6,
    fellBack: Number(r.fell_back) || 0,
    avgLatencyMs: Math.round(Number(r.avg_latency_ms) || 0)
  }));
}

/**
 * 告警判断。阈值都可通过 env 调整；返回需要告警的原因列表（空数组 = 一切正常）。
 *
 * 为什么只告这两件：
 * - 回落率异常 → 本地模型可能挂了/变慢，此时成本会静默上涨（这正是最危险的模式）；
 * - 日成本超阈值 → 说明远端在被大量使用，要么本地出问题要么有人在刷。
 */
function checkAlerts(sum) {
  const alerts = [];
  const fallbackThreshold = Number(env.AGENT_ALERT_FALLBACK_RATE || 0.2);
  const costThreshold = Number(env.AGENT_ALERT_DAILY_COST || 5);
  const minCalls = Number(env.AGENT_ALERT_MIN_CALLS || 10);
  if (sum.totals.calls >= minCalls && sum.fallbackRate > fallbackThreshold) {
    alerts.push(
      `本地模型回落率 ${(sum.fallbackRate * 100).toFixed(1)}% 超过阈值 ${(fallbackThreshold * 100).toFixed(0)}%` +
        `（${sum.totals.fellBack}/${sum.totals.calls} 轮）——本地服务可能已宕机或超时，成本正在静默上涨`
    );
  }
  if (sum.totals.costCny > costThreshold) {
    alerts.push(`近 ${sum.sinceHours}h 估算成本 ¥${sum.totals.costCny.toFixed(2)} 超过阈值 ¥${costThreshold}`);
  }
  return alerts;
}

/** 人类可读报告（给定时任务和 CLI 用） */
function renderReport(sum, alerts) {
  const lines = [];
  lines.push(`对话助手用量（近 ${sum.sinceHours} 小时）`);
  lines.push(`  总轮次 ${sum.totals.calls}，估算成本 ¥${sum.totals.costCny.toFixed(4)}，回落率 ${(sum.fallbackRate * 100).toFixed(1)}%`);
  for (const [name, s] of Object.entries(sum.byServed)) {
    lines.push(
      `  - ${name}: ${s.calls} 轮，平均 ${s.avgLatencyMs}ms（最慢 ${s.maxLatencyMs}ms），` +
        `prompt ${s.promptTokens} tok（缓存命中 ${s.cacheHitTokens}），成本 ¥${s.costCny.toFixed(4)}`
    );
  }
  if (!Object.keys(sum.byServed).length) lines.push('  （这段时间没有调用）');
  if (alerts.length) {
    lines.push('');
    lines.push('⚠️ 告警：');
    for (const a of alerts) lines.push('  - ' + a);
  }
  return lines.join('\n');
}

module.exports = { record, summary, daily, checkAlerts, renderReport, estimateCost, prices };
