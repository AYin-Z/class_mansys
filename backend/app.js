const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { env } = require('./config/env');
const logger = require('./config/logger');
const { notFoundHandler, errorHandler } = require('./shared/http');
const db = require('./config/database');

// 测试数据库连接（不阻塞启动）
async function testDatabaseConnection() {
  if (env.NODE_ENV === 'test') return; // 测试环境由用例自行准备数据库
  try {
    await db.query('SELECT 1');
    logger.info('数据库连接成功');
  } catch (error) {
    logger.error({ err: error }, '数据库连接失败');
    // 仅本地开发快速失败；test/production 均不退出（等待重连，便于测试与容器编排）
    if (env.NODE_ENV === 'development') {
      process.exit(1);
    }
  }
}

testDatabaseConnection();

const app = express();
const PORT = env.PORT;

// 部署在 Nginx / Cloudflare Tunnel 之后，读取真实客户端 IP 供限流/日志使用
app.set('trust proxy', 'loopback'); // 信任本机 Nginx（127.0.0.1）代理，取真实客户端 IP 用于限流

// 结构化访问日志 + 请求 ID（便于排查与追踪）
app.use(require('pino-http')({
  logger,
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === '/health' },
  customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info')
}));

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));
// CORS 白名单：只允许已知前端来源；Capacitor WebView（localhost / capacitor://）和 *.ayinserver.xin 均放行
const ALLOWED_CORS_ORIGINS = new Set([
  'https://cls.ayinserver.xin',
  'https://dev-cm.ayinserver.xin',
  'https://dev.ayinserver.xin',
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:5173',
  'capacitor://localhost',
  'https://localhost',
]);
function isAllowedCorsOrigin(origin) {
  if (!origin) return true; // 非浏览器请求（无 Origin）
  if (ALLOWED_CORS_ORIGINS.has(origin)) return true;
  // Capacitor Android WebView 使用 localhost + 随机端口
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}
app.use(cors({
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
// /uploads 需登录访问（图片通过 ?token= 携带令牌，见 shared/media.ts）
app.use('/uploads', require('./middleware/uploadAuth'), express.static(path.resolve(__dirname, env.UPLOAD_DIR)));
const APK_DIR = path.resolve(__dirname, env.APK_DIR);
app.use('/apk', express.static(APK_DIR));
logger.info({ apkDir: APK_DIR }, 'APK 目录');

// 速率限制（仅限API路由，不影响静态资源）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 600 // 每个IP限制600个API请求
});
app.use('/api', limiter);

// 操作记录中间件（只记录写操作，失败自吞）
app.use('/api', require('./middleware/operationLog'));

// 路由挂载表：既是 Express 挂载点，也是 Agent 工具目录的来源（避免两处维护）
const ROUTE_MOUNTS = [
  ['/api/auth', require('./routes/auth')],
  ['/api/users', require('./routes/users')],
  ['/api/leave', require('./routes/leave')],
  ['/api/notice', require('./routes/notice')],
  ['/api/announcement', require('./routes/announcement')],
  ['/api/album', require('./routes/album')],
  ['/api/fee', require('./routes/fee')],
  ['/api/homework', require('./routes/homework')],
  ['/api/psychological', require('./routes/psychological')],
  ['/api/challenge', require('./routes/challenge')],
  ['/api/vote', require('./routes/vote')],
  ['/api/suggestion', require('./routes/suggestion')],
  ['/api/lottery', require('./routes/lottery')],
  ['/api/points', require('./routes/points')],
  ['/api/classes', require('./routes/classes')],
  ['/api/message', require('./routes/message')],
  ['/api/admin', require('./routes/admin')],
  ['/api/app', require('./routes/app')],
  ['/api/company', require('./routes/company')],
  ['/api/agent', require('./routes/agent')],
  ['/api/agent/channel', require('./routes/channel')],
  ['/api/agent/tokens', require('./routes/agentTokens')],
  ['/api/mcp', require('./routes/mcp')]
];
for (const [mount, router] of ROUTE_MOUNTS) {
  app.use(mount, router);
}
// 供 Agent 工具目录复用（路由即能力清单）
app.locals.routeMounts = ROUTE_MOUNTS;

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()) });
});

// H5 前端静态文件托管（兼容旧 root dist 与新 frontend-v3/dist）
const h5DistCandidates = [
  // 优先使用 CI/本地构建产物 frontend-v3/dist，根 dist 仅作历史兼容兜底
  path.join(__dirname, '..', 'frontend-v3', 'dist'),
  path.join(__dirname, '..', 'dist')
];
const h5DistPath = h5DistCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || h5DistCandidates[0];
console.log('[static] H5 前端目录 =', h5DistPath);
app.use(express.static(h5DistPath, {
  setHeaders: (res, _filePath) => {
    // Vite 构建产物带 crossorigin 属性，需 CORS 头
    res.set('Access-Control-Allow-Origin', '*');
    // 禁用所有前端资源的缓存，解决 CDN/浏览器缓存旧版本的问题
    res.set('Cache-Control', 'no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));
// SPA 历史模式：非 API/文件路径的请求都返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/uploads')) {
    return next();
  }
  // 静态资源文件不存在时直接 404，不要返回 index.html
  // 否则 Vite 6 的 CSS preload 请求不存在的 .css 会收到错误的 text/html
  if (/\.(js|css|map|json|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)$/i.test(req.path)) {
    return next();
  }
  res.sendFile(path.join(h5DistPath, 'index.html'));
});

// 404 处理
app.use(notFoundHandler);

// 统一错误处理
app.use(errorHandler);

// 仅在直接运行时监听端口（被 require/测试导入时不监听）
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, '服务器已启动');
  });
}

module.exports = app;