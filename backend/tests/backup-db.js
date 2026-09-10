#!/usr/bin/env node
/**
 * 逻辑备份：把指定库的所有基表导出为 JSON（无 mysqldump 时使用）。
 * 用法：node tests/backup-db.js [dbName] [outDir]
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  const db = process.argv[2] || process.env.DB_NAME || 'class_manage_sys';
  const outDir = process.argv[3] || '/home/ayin/db_backups';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306), database: db
  });
  const [tables] = await conn.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME", [db]);
  const dump = {};
  let total = 0;
  for (const t of tables) {
    const name = t.TABLE_NAME;
    const [rows] = await conn.query('SELECT * FROM `' + name + '`');
    dump[name] = rows;
    total += rows.length;
  }
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, db + '_' + stamp + '.json');
  fs.writeFileSync(file, JSON.stringify({ db, createdAt: new Date().toISOString(), tables: dump }));
  console.log('backup ->', file, '(' + tables.length + ' tables, ' + total + ' rows)');
  await conn.end();
})().catch(e => { console.error('BACKUP_ERROR:', e.message); process.exit(1); });
