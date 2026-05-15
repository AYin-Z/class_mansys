const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./config/database');

// 测试数据库连接（不阻塞启动）
async function testDatabaseConnection() {
  try {
    const [rows] = await db.query('SELECT 1');
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error.message);
    // CloudRun 环境下不退出，等待后续重连
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
}

testDatabaseConnection();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:5173',
      'https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com',
      'https://cls.ayinserver.xin'
    ];
    // 无 origin 的场景（服务器内部调用、curl 等）也放行
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 速率限制（仅限API路由，不影响静态资源）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200 // 每个IP限制200个API请求
});
app.use('/api', limiter);

// 操作记录中间件（只记录写操作，失败自吞）
app.use('/api', require('./middleware/operationLog'));

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
app.use('/api/classes', require('./routes/classes'));
app.use('/api/message', require('./routes/message'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/app', require('./routes/app'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// H5 前端静态文件托管（构建产物在 dist/）
const h5DistPath = path.join(__dirname, '..', 'dist');
app.use(express.static(h5DistPath));
// SPA 历史模式：非 API/文件路径的请求都返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(h5DistPath, 'index.html'));
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