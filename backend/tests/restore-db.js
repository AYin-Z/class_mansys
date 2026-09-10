#!/usr/bin/env node
/**
 * 从逻辑备份 JSON 恢复数据库（危险操作，需 --yes）。
 * 用法：node tests/restore-db.js <dbName> <backup.json> --yes
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  const db = process.argv[2];
  const file = process.argv[3];
  const yes = process.argv.includes('--yes');
  if (!db || !file || !yes) { console.error('用法: node tests/restore-db.js <db> <backup.json> --yes'); process.exit(1); }
  const dump = JSON.parse(fs.readFileSync(file, 'utf8')).tables;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306),
    database: db, multipleStatements: true
  });
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  const tables = Object.keys(dump);
  for (const table of tables) {
    const rows = dump[table] || [];
    await conn.query('DELETE FROM `' + table + '`');
    if (rows.length) {
      const cols = Object.keys(rows[0]);
      const colSql = cols.map(c => '`' + c + '`').join(',');
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
              const d = new Date(v);
              const p2 = (n) => String(n).padStart(2, '0');
              v = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
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
    console.log('restored', table, rows.length);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('DONE restore ->', db, 'tables=' + tables.length);
  await conn.end();
})().catch(e => { console.error('RESTORE_ERROR:', e.message); process.exit(1); });
