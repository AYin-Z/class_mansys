/**
 * 会话历史按 token 预算裁剪
 *
 * 为什么需要：agentService 原来固定带最近 30 条消息。本地模型每槽上下文
 * 是 `n_ctx / n_parallel`（当前 16384），而工具表 + system prompt 已经占掉 8284，
 * 加满 30 条历史是 11024，余量只有 4560。
 * 实测当前不会溢出，但如果将来工具表变大、或用户粘贴长文本，就会被撑爆——
 * 一旦超限本地返回 400，请求会回落到 DeepSeek（能用，但在花钱）。
 * 所以这里加一道预算守卫：超预算就从**最旧**的消息开始丢。
 *
 * 估算方式：中文约 1.5 字符/token，英文约 4 字符/token。这里按 1.2 字符/token
 * 保守估算（宁可高估，提前裁掉几条，也不要低估导致真的超限）。
 */

const CHARS_PER_TOKEN = 1.2;

/** 粗估一段文本的 token 数（保守偏高） */
function estimateTokens(text) {
  const s = String(text || '');
  if (!s) return 0;
  return Math.ceil(s.length / CHARS_PER_TOKEN);
}

/**
 * 从最旧的开始丢，直到总量落进预算。
 * 返回新数组（不修改入参），并保持原顺序。
 *
 * @param {Array<{role:string, content:string}>} history 按时间正序
 * @param {number} budgetTokens 预算（0 或负数 = 不限制）
 */
function trimHistoryToBudget(history, budgetTokens) {
  const list = Array.isArray(history) ? history : [];
  const budget = Number(budgetTokens) || 0;
  if (budget <= 0) return list.slice();

  // 从最新往回收，收集能放下的部分
  const kept = [];
  let used = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i];
    const cost = estimateTokens(m && m.content);
    if (used + cost > budget && kept.length > 0) break;
    used += cost;
    kept.push(m);
  }
  kept.reverse();
  return kept;
}

module.exports = { estimateTokens, trimHistoryToBudget, CHARS_PER_TOKEN };
