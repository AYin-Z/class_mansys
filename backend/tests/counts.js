const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
(async () => {
  const db = process.argv[2] || 'class_manage_sys_test';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306), database: db
  });
  for (const t of ['users','classes','companies','leaves','notices','suggestions','points','expenses']) {
    try { const [[r]] = await conn.query('SELECT COUNT(*) AS c FROM `' + t + '`'); console.log(t, r.c); }
    catch (e) { console.log(t, 'ERR', e.message); }
  }
  const [cls] = await conn.query('SELECT id, name, company_id FROM classes');
  console.log('classes:', JSON.stringify(cls));
  const [comp] = await conn.query('SELECT * FROM companies');
  console.log('companies:', JSON.stringify(comp));
  await conn.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
