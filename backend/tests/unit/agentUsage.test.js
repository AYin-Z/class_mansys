import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const usage = require('../../services/agent/usage');
const { estimateTokens, trimHistoryToBudget } = require('../../services/agent/history');

describe('用量记账：成本估算', () => {
  it('本地模型成本为 0（但 token 照样记）', () => {
    expect(
      usage.estimateCost({ servedBy: 'local', promptTokens: 8000, completionTokens: 200 })
    ).toBe(0);
  });

  it('远端按 缓存命中/未命中/输出 三档计价', () => {
    // 默认价：命中 0.5、未命中 2、输出 8（元/百万）
    const cost = usage.estimateCost({
      servedBy: 'remote',
      promptTokens: 1000000,
      completionTokens: 1000000,
      cacheHitTokens: 1000000,
      cacheMissTokens: 0
    });
    expect(cost).toBeCloseTo(8.5, 6); // 0.5 + 8
  });

  it('缓存命中比未命中便宜（这是保持前缀静态的动力）', () => {
    const hit = usage.estimateCost({ servedBy: 'remote', promptTokens: 1e6, cacheHitTokens: 1e6 });
    const miss = usage.estimateCost({ servedBy: 'remote', promptTokens: 1e6, cacheMissTokens: 1e6 });
    expect(hit).toBeLessThan(miss);
    expect(miss / hit).toBeCloseTo(4, 1); // 2 / 0.5
  });

  it('上游不返回缓存明细时按未命中计价（不低估成本）', () => {
    const cost = usage.estimateCost({ servedBy: 'remote', promptTokens: 1e6, completionTokens: 0 });
    expect(cost).toBeCloseTo(2, 6);
  });
});

describe('用量记账：告警判断', () => {
  const sum = (calls, fellBack, cost) => ({
    sinceHours: 24,
    totals: { calls, fellBack, costCny: cost },
    byServed: {},
    fallbackRate: calls ? fellBack / calls : 0
  });

  it('样本太少不告警（避免刚上线就误报）', () => {
    expect(usage.checkAlerts(sum(3, 3, 0))).toEqual([]);
  });

  it('回落率超阈值要告警——本地挂了会静默改用花钱的远端', () => {
    const alerts = usage.checkAlerts(sum(100, 50, 0));
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain('回落率');
  });

  it('成本超阈值要告警', () => {
    const alerts = usage.checkAlerts(sum(100, 0, 99));
    expect(alerts.some((a) => a.includes('成本'))).toBe(true);
  });

  it('正常情况不告警', () => {
    expect(usage.checkAlerts(sum(100, 2, 0.5))).toEqual([]);
  });
});

describe('会话历史 token 预算', () => {
  const hist = (n, chars) =>
    Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(chars) }));

  it('预算为 0 表示不限制', () => {
    const h = hist(10, 100);
    expect(trimHistoryToBudget(h, 0)).toHaveLength(10);
  });

  it('超预算时从最旧的开始丢，保留最新的', () => {
    const h = hist(10, 120); // 每条约 100 tok
    const kept = trimHistoryToBudget(h, 300);
    expect(kept.length).toBeLessThan(10);
    // 保留的必须是尾部（最新）那几条
    expect(kept[kept.length - 1]).toBe(h[h.length - 1]);
  });

  it('裁剪后总量落进预算', () => {
    const h = hist(20, 120);
    const budget = 500;
    const kept = trimHistoryToBudget(h, budget);
    const total = kept.reduce((s, m) => s + estimateTokens(m.content), 0);
    expect(total).toBeLessThanOrEqual(budget);
  });

  it('至少保留一条（否则模型看不到本轮问题）', () => {
    const h = hist(5, 100000);
    expect(trimHistoryToBudget(h, 10).length).toBeGreaterThanOrEqual(1);
  });

  it('中文估算偏保守（宁可高估，提前裁）', () => {
    expect(estimateTokens('你好世界')).toBeGreaterThanOrEqual(3);
  });
});
