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

/**
 * 前端启动诊断上报（无需登录）
 *
 * 背景：2026-09 手机端白屏事故里，用户在手机上「啥也没有」——
 * 既没有页面也没有错误提示，我们拿不到任何现场信息。
 * 这里提供一个极小的采集端点，index.html 的启动脚本用 sendBeacon 上报：
 *   - boot-ok   ：应用挂载成功（用于确认某台设备/某个构建到底有没有跑起来）
 *   - error     ：脚本错误、资源加载失败、未处理的 Promise 异常
 *   - timeout   ：8 秒内没挂载成功
 * 只落盘 JSON 行到 logs/client-errors.log，便于事后排查；限流与长度截断都在这里做。
 */
const CLIENT_LOG_MAX_LEN = 800;
const clientLogHits = new Map();
app.post('/api/client-log', (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const hit = clientLogHits.get(ip) || { count: 0, resetAt: now + 60000 };
    if (now > hit.resetAt) { hit.count = 0; hit.resetAt = now + 60000; }
    hit.count += 1;
    clientLogHits.set(ip, hit);
    // 每 IP 每分钟最多 20 条，超出直接丢弃（防滥用）
    if (hit.count > 20) return res.status(204).end();

    const body = req.body || {};
    const clip = (v) => (typeof v === 'string' ? v.slice(0, CLIENT_LOG_MAX_LEN) : v);
    const entry = {
      at: new Date().toISOString(),
      kind: clip(body.kind) || 'unknown',
      build: clip(body.build),
      url: clip(body.url),
      message: clip(body.message),
      stack: clip(body.stack),
      ua: clip(String(req.headers['user-agent'] || '')),
      ip,
      viewport: clip(body.viewport)
    };
    const line = JSON.stringify(entry);
    const logFile = path.join(__dirname, 'logs', 'client-errors.log');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFile(logFile, line + '\n', () => {});
    logger.warn({ clientLog: entry }, '前端上报');
    return res.status(204).end();
  } catch (err) {
    logger.error({ err }, 'client-log 写入失败');
    return res.status(204).end();
  }
});

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
/**
 * H5 静态资源缓存策略（2026-09-11 白屏事故后重定）
 *
 * 旧策略是「所有前端资源一律 no-store」，看似安全，实则两处有害：
 *  1. 每次访问都要回源拉全部 hash 文件，移动端弱网下慢且易失败；
 *  2. 一旦某个 chunk 被删（历史上 Vite 每次构建清空 dist），
 *     Cloudflare 会把 404 缓存 4 小时，用户长时间拿不到正确文件。
 *
 * 现在的策略：
 *  - /assets/**：文件名带内容 hash，内容不可变 → 长缓存 immutable
 *    （配合 vite.config.ts 的 emptyOutDir:false 保留旧文件，老客户端也能取到）
 *  - 其它（index.html、favicon 等）：no-store，保证每次拿到最新入口
 *  - CDN-Cache-Control 同步下发，避免 Cloudflare 用默认规则缓存 404
 */
function setH5CacheHeaders(res, filePath) {
  res.set('Access-Control-Allow-Origin', '*');
  const isHashedAsset = /[\\/]assets[\\/]/.test(filePath);
  if (isHashedAsset) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.set('Cache-Control', 'no-store, must-revalidate');
    res.set('CDN-Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}
app.use(express.static(h5DistPath, { setHeaders: setH5CacheHeaders }));
// SPA 历史模式：非 API/文件路径的请求都返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/uploads')) {
    return next();
  }
  // 静态资源文件不存在时直接 404，不要返回 index.html
  // 否则 Vite 6 的 CSS preload 请求不存在的 .css 会收到错误的 text/html
  if (/\.(js|css|map|json|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)$/i.test(req.path)) {
    // 关键：告诉 Cloudflare 不要缓存这个 404。
    // 历史上 CF 会按默认规则把 404 缓存 4 小时，导致文件恢复后用户仍拿不到。
    res.set('Cache-Control', 'no-store, must-revalidate');
    res.set('CDN-Cache-Control', 'no-store');
    return next();
  }
  res.sendFile(path.join(h5DistPath, 'index.html'));
});

// 404 处理
app.use(notFoundHandler);

// 统一错误处理
app.use(errorHandler);

// 仅在直接运行时监听端口（被 require/测试导入时不监听）
/** 加载可配置权限矩阵（表为空/不存在时静默回落到代码默认矩阵） */
async function initPermissions() {
  try {
    const { loadPermissions, seedPermissionsFromDefaults } = require('./shared/permissions');
    const loaded = await loadPermissions();
    if (!loaded) {
      const seeded = await seedPermissionsFromDefaults();
      logger.info({ seeded }, seeded ? '权限矩阵已初始化为默认值' : '权限矩阵使用代码默认值');
    }
  } catch (e) {
    logger.warn({ err: e.message }, '权限矩阵加载失败，使用默认值');
  }
}
initPermissions();
// 权限矩阵每 30 秒与数据库对一次（防止多进程/外部改动导致缓存过期）；unref 不阻塞进程退出
setInterval(() => {
  require('./shared/permissions').loadPermissions().catch(() => {});
}, 30000).unref();

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, '服务器已启动');
  });
}

module.exports = app;