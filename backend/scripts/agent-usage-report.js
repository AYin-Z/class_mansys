#!/usr/bin/env node
/**
 * 对话助手用量报告 + 告警（P0 观测的出口）
 *
 * 用法：
 *   node scripts/agent-usage-report.js                 # 近 24 小时
 *   node scripts/agent-usage-report.js --hours 6
 *   node scripts/agent-usage-report.js --daily 14      # 附带按天趋势
 *   node scripts/agent-usage-report.js --dry-run       # 只打印，不发邮件
 *   node scripts/agent-usage-report.js --always-mail   # 无告警也发（日报用）
 *
 * 告警只发两类（见 services/agent/usage.js 的 checkAlerts）：
 *   1) 回落率异常——本地模型挂了会静默改用花钱的远端，这是最危险的模式；
 *   2) 日成本超阈值。
 * 未配置 SMTP 时只落盘（与 send-suggestion-digest.js 行为一致，不报错）。
 */
const path = require('path');
const fs = require('fs');
const { env } = require('../config/env');
const usage = require('../services/agent/usage');
const mailer = require('../services/mailer');

(async () => {
  const arg = (name, def) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? Number(process.argv[i + 1]) : def;
  };
  const hours = arg('--hours', 24);
  const dailyDays = arg('--daily', 0);
  const dryRun = process.argv.includes('--dry-run');
  const alwaysMail = process.argv.includes('--always-mail');

  const sum = await usage.summary({ sinceHours: hours });
  const alerts = usage.checkAlerts(sum);

  // 本地模型健康：独立于流量告警。
  // 助手用量极低，"回落率"告警永远够不到阈值；但本地模型挂了会让所有请求静默走 API 花钱，
  // 所以预热探测到的连续失败必须能发出来。
  try {
    const health = require('../services/agent/warmup').readHealth();
    if (health && health.ok === false && Number(health.consecutiveFailures) >= 3) {
      alerts.push(
        '本地模型连续 ' + health.consecutiveFailures + ' 次探测失败（最近一次：' + (health.detail || '未知') +
          '）——对话已全部回落到 DeepSeek，成本在持续产生。检查：systemctl --user status class-mansys-llm'
      );
    }
  } catch (e) { /* 健康文件缺失不算问题 */ }
  const text = usage.renderReport(sum, alerts);

  let extra = '';
  if (dailyDays > 0) {
    const rows = await usage.daily({ days: dailyDays });
    if (rows.length) {
      extra = '\n\n按天：\n' + rows.map((r) =>
        `  ${r.date} ${r.servedBy}: ${r.calls} 轮，¥${r.costCny.toFixed(4)}，回落 ${r.fellBack}，平均 ${r.avgLatencyMs}ms`
      ).join('\n') + '\n';
    }
  }

  const full = text + extra;
  const outDir = process.env.AGENT_USAGE_DIR || '/home/ayin/db_backups/agent-usage';
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 13).replace('T', '-');
  const file = path.join(outDir, stamp + '-agent-usage.txt');
  fs.writeFileSync(file, full);
  console.log(full);
  console.log('[report] 已落盘：' + file);

  if (dryRun) process.exit(0);
  if (!alerts.length && !alwaysMail) {
    console.log('[report] 无告警，不发送邮件。');
    process.exit(0);
  }

  const to = env.SUGGESTION_DIGEST_TO || '2792715318@qq.com';
  const subject = (alerts.length ? '⚠️ 对话助手告警' : '对话助手用量日报') + '（近 ' + hours + ' 小时）';
  const result = await mailer.sendMail({ to, subject, text: full });
  if (result.skipped) {
    console.log('[report] SMTP 未配置，本次仅落盘，未发邮件。');
  } else {
    console.log('[report] 已发送至 ' + to + '（messageId=' + result.messageId + '）');
  }
  process.exit(0);
})().catch((e) => { console.error('AGENT_USAGE_ERROR:', e.message); process.exit(1); });
