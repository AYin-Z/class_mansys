const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306), database: 'class_manage_sys_test' });
  const [rows] = await conn.query("SELECT l.id, l.user_id, u.name, u.class_id, u.role, l.leave_type, l.start_time, l.end_time, l.status, l.is_cancelled FROM leaves l JOIN users u ON l.user_id=u.id ORDER BY l.id DESC LIMIT 12");
  console.log(JSON.stringify(rows, null, 1));
  const [[now]] = await conn.query('SELECT NOW() AS n');
  console.log('DB NOW', now.n);
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
