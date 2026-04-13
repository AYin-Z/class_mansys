const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');

// 测试数据库连接
async function testDatabaseConnection() {
  try {
    const [rows] = await db.query('SELECT 1');
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
}

testDatabaseConnection();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 每个IP限制100个请求
});
app.use(limiter);

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leave', require('./routes/leave'));
app.use('/api/notice', require('./routes/notice'));
app.use('/api/announcement', require('./routes/announcement'));
app.use('/api/album', require('./routes/album'));
app.use('/api/fee', require('./routes/fee'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/psychological', require('./routes/psychological'));
app.use('/api/challenge', require('./routes/challenge'));
app.use('/api/vote', require('./routes/vote'));
app.use('/api/suggestion', require('./routes/suggestion'));
app.use('/api/lottery', require('./routes/lottery'));
app.use('/api/points', require('./routes/points'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;