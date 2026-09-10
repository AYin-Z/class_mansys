const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mysql = require('mysql2/promise');
(async () => {
  const db = process.argv[2];
  const file = process.argv[3];
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306),
    database: db, multipleStatements: true
  });
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', file), 'utf-8');
  await conn.query(sql);
  console.log('applied ' + file + ' -> ' + db);
  await conn.end();
})().catch(e => { console.error('MIGRATION_ERROR:', e.message); process.exit(1); });
