const pino = require('pino');
const { env } = require('./env');

const logger = pino({
  // 测试环境默认静默（需要日志时显式设置 LOG_LEVEL）；生产 info，开发 debug
  level: env.LOG_LEVEL || (env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'class-mansys', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'password', '*.password'],
    censor: '[redacted]'
  }
});

module.exports = logger;
