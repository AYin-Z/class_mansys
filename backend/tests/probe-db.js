const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true
  });
  const [dbs] = await conn.query('SHOW DATABASES');
  console.log('DATABASES:', dbs.map(d => Object.values(d)[0]).join(', '));
  const [tables] = await conn.query('SHOW TABLES FROM `' + (process.env.DB_NAME || 'class_manage_sys') + '`');
  console.log('TABLE_COUNT:', tables.length);
  console.log('TABLES:', tables.map(t => Object.values(t)[0]).sort().join(', '));
  // check key columns
  const db = process.env.DB_NAME || 'class_manage_sys';
  const [cols] = await conn.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND ((TABLE_NAME='suggestions' AND COLUMN_NAME='view_token') OR (TABLE_NAME='classes' AND COLUMN_NAME='company_id'))",
    [db]
  );
  console.log('KEY_COLUMNS:', JSON.stringify(cols));
  await conn.end();
})().catch(e => { console.error('PROBE_ERROR:', e.message); process.exit(1); });
