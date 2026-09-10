const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
(async () => {
  const targets = process.argv.slice(2);
  if (!targets.length) { console.error('usage: node tests/drop-test-dbs.js <db...>'); process.exit(1); }
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', port: Number(process.env.DB_PORT || 3306) });
  for (const db of targets) {
    if (!/_test[0-9]*$/.test(db)) { console.log('SKIP (not a test db):', db); continue; }
    await conn.query('DROP DATABASE IF EXISTS `' + db + '`');
    console.log('dropped', db);
  }
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
