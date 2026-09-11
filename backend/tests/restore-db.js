#!/usr/bin/env node
/**
 * 从逻辑备份 JSON 恢复数据库（危险操作，需 --yes）。
 * 用法：node tests/restore-db.js <dbName> <backup.json> --yes [--allow-prod-db=<dbName>]
 *
 * 护栏（见 tests/lib/dbGuard.js）：
 *   - 只允许 _test 结尾的测试库；非测试库必须显式 --allow-prod-db=<同名库> 才放行；
 *   - 库名/表名/列名一律先做标识符校验，避免备份文件被污染后拼出任意 SQL；
 *   - 整段恢复（DELETE + INSERT）放在单个事务里，任一步失败整体回滚；
 *   - 连接上显式 SET time_zone='+8:00'，与 config/database.js 一致，
 *     避免宿主机为 UTC 时把备份里的 TIMESTAMP 偏移 8 小时。
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { assertRestorableDbName, assertSafeIdentifier } = require('./lib/dbGuard');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

/**
 * 把备份里的 UTC ISO 时间串还原成东八区墙钟字符串。
 * 会话已显式 time_zone='+8:00'，因此这里必须按东八区换算，
 * 不能依赖宿主机本地时区（TZ=UTC 的机器上会整体偏移 8 小时）。
 */
function toBeijingDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const t = new Date(d.getTime() + BEIJING_OFFSET_MS);
  const p2 = (n) => String(n).padStart(2, '0');
  return (
    t.getUTCFullYear() + '-' + p2(t.getUTCMonth() + 1) + '-' + p2(t.getUTCDate()) + ' ' +
    p2(t.getUTCHours()) + ':' + p2(t.getUTCMinutes()) + ':' + p2(t.getUTCSeconds())
  );
}

(async () => {
  const dbArg = process.argv[2];
  const file = process.argv[3];
  const yes = process.argv.includes('--yes');
  if (!dbArg || !file || !yes) {
    console.error('用法: node tests/restore-db.js <db> <backup.json> --yes [--allow-prod-db=<db>]');
    process.exit(1);
  }

  // 护栏 1：库名白名单（测试库，或显式放行的生产库）
  const db = assertRestorableDbName(dbArg, process.argv, '恢复目标库名');

  const dump = JSON.parse(fs.readFileSync(file, 'utf8')).tables || {};
  // 护栏 2：表名来自备份文件，必须先校验为合法标识符
  const tables = Object.keys(dump).map((t) => assertSafeIdentifier(t, '备份表名'));

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306),
    database: db, multipleStatements: true
  });

  // 与 config/database.js 保持一致的连接会话时区
  await conn.query("SET time_zone = '+8:00'");

  // 前置检查：备份里的表必须在目标库中存在，缺表属于"备份/结构不匹配"，不进入写库阶段
  const [existRows] = await conn.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
  );
  const existing = new Set(existRows.map((r) => r.TABLE_NAME));
  const missing = tables.filter((t) => !existing.has(t));
  if (missing.length) {
    await conn.end();
    throw new Error('目标库缺少备份中的表: ' + missing.join(', ') + '（请先执行迁移/建表再恢复）');
  }

  let tableDone = 0;
  let rowTotal = 0;
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  try {
    await conn.beginTransaction();

    for (const table of tables) {
      const rows = dump[table] || [];
      await conn.query('DELETE FROM `' + table + '`');
      if (rows.length) {
        // 护栏 3：列名同样来自备份文件，必须校验
        const cols = Object.keys(rows[0]).map((c) => assertSafeIdentifier(c, '备份列名'));
        const colSql = cols.map((c) => '`' + c + '`').join(',');
        const ph = '(' + cols.map(() => '?').join(',') + ')';
        const chunk = 200;
        for (let i = 0; i < rows.length; i += chunk) {
          const part = rows.slice(i, i + chunk);
          const values = [];
          const holders = [];
          for (const r of part) {
            holders.push(ph);
            for (const c of cols) {
              let v = r[c];
              if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)) {
                v = toBeijingDateTime(v);
              }
              if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) {
                v = Buffer.from(v.data);
              } else if (v && typeof v === 'object' && !(v instanceof Date)) {
                v = JSON.stringify(v);
              }
              values.push(v);
            }
          }
          await conn.query('INSERT INTO `' + table + '` (' + colSql + ') VALUES ' + holders.join(','), values);
        }
      }
      tableDone += 1;
      rowTotal += rows.length;
      console.log('  [restore] ' + table + ' (' + rows.length + ' 行)');
    }

    await conn.commit();
    console.log('事务提交完成: ' + tableDone + ' 张表 / ' + rowTotal + ' 行');
  } catch (e) {
    try { await conn.rollback(); } catch (_) { /* 连接已断开时忽略 */ }
    throw new Error('恢复失败，已整体回滚（目标库保持原状）: ' + e.message, { cause: e });
  } finally {
    try { await conn.query('SET FOREIGN_KEY_CHECKS=1'); } catch (_) { /* 忽略 */ }
    await conn.end();
  }

  console.log('DONE restore ->', db, 'tables=' + tableDone);
})().catch(e => { console.error('RESTORE_ERROR:', e.message); process.exit(1); });
