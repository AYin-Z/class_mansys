const mysql = require('mysql2');
const { env } = require('./env');

const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
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
