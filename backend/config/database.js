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
  // 不设 timezone，用 dateStrings 避免时区转换，保留原始字符串
  dateStrings: true,
  charset: 'utf8mb4'
});

// 每个新连接设置时区和字符集
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+8:00'", (err) => {
    if (err) console.error('设置时区失败:', err.message);
  });
  conn.query("SET NAMES utf8mb4", (err) => {
    if (err) console.error('设置字符集失败:', err.message);
  });
});

const promisePool = pool.promise();

module.exports = promisePool;
