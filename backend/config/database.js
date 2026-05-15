const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'class_manage_sys',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+08:00'
});

// 每个新连接自动设置时区为 +08:00
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+8:00'", (err) => {
    if (err) console.error('设置时区失败:', err.message);
  });
});

const promisePool = pool.promise();

module.exports = promisePool;
