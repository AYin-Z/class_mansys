const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const TABLES = ['notices','announcements','albums','homeworks','votes','lotteries','messages','resources','points','psychological_applications','expenses','fee_collections','fee_publications','challenges'];
(async () => {
  const db = process.argv[2] || process.env.DB_NAME || 'class_manage_sys';
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306), database: db });
  for (const t of TABLES) {
    try {
      const [[c]] = await conn.query("SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'class_id'", [db, t]);
      const [[n]] = await conn.query('SELECT COUNT(*) AS total, SUM(class_id IS NULL) AS nulls FROM `' + t + '`');
      console.log(t, 'col=' + c.c, 'rows=' + n.total, 'null_class=' + (n.nulls || 0));
    } catch (e) { console.log(t, 'ERR', e.message); }
  }
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
