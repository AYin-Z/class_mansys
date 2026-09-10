const db = require('../config/database');

// 允许打区队标记的表白名单（防 SQL 注入）
const ALLOWED_TABLES = new Set([
  'notices', 'announcements', 'albums', 'homeworks', 'votes', 'lotteries', 'challenges',
  'messages', 'resources', 'points', 'psychological_applications', 'expenses',
  'fee_collections', 'fee_publications'
]);

/** 给新建记录写入区队归属（NULL=全局/中队级） */
async function stampClassId(table, id, classId) {
  if (!ALLOWED_TABLES.has(table)) throw new Error('stampClassId: table not allowed: ' + table);
  if (!id) return false;
  await db.query('UPDATE `' + table + '` SET class_id = ? WHERE id = ?', [classId || null, id]);
  return true;
}

module.exports = { stampClassId, ALLOWED_TABLES };
