const db = require('../config/database');

/** 汇总 [sinceHours] 小时内的建议 + 近期服务端错误，生成每日摘要 */
async function buildDigest({ sinceHours = 24 } = {}) {
  const hours = Math.max(1, Number(sinceHours) || 24);

  const [suggestions] = await db.query(
    'SELECT id, content, category, status, handler_notes, created_at FROM suggestions WHERE created_at > DATE_SUB(NOW(), INTERVAL ? HOUR) ORDER BY created_at ASC',
    [hours]
  );
  const [[counts]] = await db.query(
    'SELECT COUNT(*) AS total, SUM(status = 0) AS pending, SUM(status = 1) AS doing, SUM(status = 2) AS done FROM suggestions'
  );
  const [errors] = await db.query(
    'SELECT path, method, status_code, COUNT(*) AS hits FROM operation_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL ? HOUR) AND status_code >= 500 GROUP BY path, method, status_code ORDER BY hits DESC LIMIT 10',
    [hours]
  );

  const now = new Date();
  const title = '区队系统 · 每日建议汇总 ' + now.toISOString().slice(0, 10);

  const lines = [];
  lines.push(title);
  lines.push('统计窗口：最近 ' + hours + ' 小时');
  lines.push('');
  lines.push('【新增建议】 ' + suggestions.length + ' 条');
  if (suggestions.length === 0) {
    lines.push('（无）');
  } else {
    suggestions.forEach((s, i) => {
      const statusText = s.status === 0 ? '待处理' : s.status === 1 ? '处理中' : '已处理';
      lines.push((i + 1) + '. [' + statusText + '][' + (s.category || '未分类') + '] ' + String(s.content).replace(/\s+/g, ' ').slice(0, 300));
      if (s.handler_notes) lines.push('   回复：' + String(s.handler_notes).slice(0, 200));
    });
  }
  lines.push('');
  lines.push('【全库累计】 共 ' + Number(counts.total || 0) + ' 条（待处理 ' + Number(counts.pending || 0) + ' / 处理中 ' + Number(counts.doing || 0) + ' / 已处理 ' + Number(counts.done || 0) + '）');
  lines.push('');
  lines.push('【近 ' + hours + ' 小时服务端 5xx】 ' + errors.length + ' 类');
  if (errors.length === 0) {
    lines.push('（无，系统运行正常）');
  } else {
    errors.forEach((e) => lines.push('- ' + e.method + ' ' + e.path + ' → ' + e.status_code + ' ×' + e.hits));
  }
  lines.push('');
  lines.push('—— 由 class_mansys 自动生成（scripts/send-suggestion-digest.js）');

  const text = lines.join('\n');
  const html = '<h3>' + title + '</h3>' +
    '<p>统计窗口：最近 ' + hours + ' 小时；新增建议 <b>' + suggestions.length + '</b> 条</p>' +
    '<ol>' + suggestions.map((s) => '<li><b>[' + (s.category || '未分类') + ']</b> ' + escapeHtml(String(s.content).slice(0, 500)) + '</li>').join('') + '</ol>' +
    '<p>全库累计：' + Number(counts.total || 0) + ' 条（待处理 ' + Number(counts.pending || 0) + ' / 处理中 ' + Number(counts.doing || 0) + ' / 已处理 ' + Number(counts.done || 0) + '）</p>' +
    '<p>近 ' + hours + ' 小时 5xx：' + (errors.length ? '<ul>' + errors.map((e) => '<li>' + e.method + ' ' + e.path + ' → ' + e.status_code + ' ×' + e.hits + '</li>').join('') + '</ul>' : '无') + '</p>';

  return { title, text, html, newCount: suggestions.length, counts, errors };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { buildDigest };
