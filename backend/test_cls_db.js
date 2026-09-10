#!/usr/bin/env node
// 从运行中的 Node 进程所在目录加载 .env，测试 DB 连接
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const pw = process.env.DB_PASSWORD || '(empty)';
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD length:', pw.length, ' chars');
console.log('DB_PASSWORD hash (sha256):', require('crypto').createHash('sha256').update(pw).digest('hex').slice(0,16));

// 测试连接
const mysql = require('mysql2');
const conn = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: pw,
  database: process.env.DB_NAME || 'class_manage_sys'
});
conn.query('SELECT 1 as ok', (err, rows) => {
  if (err) { console.error('DB CONNECT ERROR:', err.code, err.sqlMessage); conn.end(); return; }
  console.log('DB CONNECT: OK', JSON.stringify(rows));
  conn.query('SELECT id, student_id, name FROM users LIMIT 3', (e2, r2) => {
    if (e2) console.error('QUERY ERROR:', e2.message);
    else console.log('USERS:', JSON.stringify(r2));
    conn.end();
  });
});
