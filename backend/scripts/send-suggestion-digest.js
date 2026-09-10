#!/usr/bin/env node
/**
 * 每日建议汇总：发送到 SUGGESTION_DIGEST_TO（默认 2792715318@qq.com）
 * 用法：node scripts/send-suggestion-digest.js [--hours 24] [--dry-run]
 * 未配置 SMTP 时：仅落盘到 BACKUP_DIR/digests/ 并打印摘要（不报错）。
 */
const path = require('path');
const fs = require('fs');
const { env } = require('../config/env');
const { buildDigest } = require('../services/suggestionDigest');
const mailer = require('../services/mailer');

(async () => {
  const hoursArg = process.argv.indexOf('--hours');
  const hours = hoursArg > -1 ? Number(process.argv[hoursArg + 1]) : 24;
  const dryRun = process.argv.includes('--dry-run');

  const digest = await buildDigest({ sinceHours: hours });
  const to = env.SUGGESTION_DIGEST_TO || '2792715318@qq.com';

  const outDir = process.env.DIGEST_DIR || '/home/ayin/db_backups/digests';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, new Date().toISOString().slice(0, 10) + '-suggestion-digest.txt');
  fs.writeFileSync(file, digest.text);
  console.log('[digest] 已生成：' + file + '（新增建议 ' + digest.newCount + ' 条）');

  if (dryRun) {
    console.log('--- 邮件预览 ---');
    console.log(digest.text);
    process.exit(0);
  }

  const result = await mailer.sendMail({ to, subject: digest.title, text: digest.text, html: digest.html });
  if (result.skipped) {
    console.log('[digest] SMTP 未配置（SMTP_HOST/SMTP_USER/SMTP_PASS），本次仅落盘，未发送邮件。');
    console.log('         配置后即可自动发送到 ' + to);
  } else {
    console.log('[digest] 已发送至 ' + to + '（messageId=' + result.messageId + '）');
  }
  process.exit(0);
})().catch((e) => { console.error('DIGEST_ERROR:', e.message); process.exit(1); });
