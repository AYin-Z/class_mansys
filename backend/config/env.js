const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { z } = require('zod');

/**
 * 环境变量校验（P0）：启动即失败，避免"缺配置悄悄跑起来"。
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1).default('class_manage_sys'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET 不能为空'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  OTP_PROVIDER: z.string().optional().default(''),
  OTP_DEBUG_CONSOLE: z.string().optional().default(''),
  LOG_LEVEL: z.string().optional().default(''),
  UPLOAD_DIR: z.string().optional().default('./uploads'),
  APK_DIR: z.string().optional().default('./apk'),
  // /uploads 访问控制：strict=必须带令牌；compat=兼容尚未携带令牌的旧 APK（灰度期）
  UPLOAD_AUTH_MODE: z.enum(['strict', 'compat']).default('strict'),

  // ---- 对话式 Agent ----
  AGENT_LLM_MODE: z.enum(['auto', 'live', 'mock', 'off', 'hybrid']).default('auto'),
  // 主模型（hybrid 模式下先走它）。指向本地 llama-server 时无需 API key。
  LLM_LOCAL_BASE_URL: z.string().optional().default(''),
  LLM_LOCAL_MODEL: z.string().optional().default(''),
  LLM_LOCAL_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  // hybrid 模式下谁优先：local=本地优先省钱（默认）；remote=远端优先、本地兜底（灰度期用）
  LLM_PREFER: z.enum(['local', 'remote']).default('local'),
  // 上游连续失败几次后临时跳过（避免假死时每个请求都白等满超时）
  LLM_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(3),
  LLM_BREAKER_COOLDOWN_MS: z.coerce.number().int().positive().default(60000),
  LLM_BASE_URL: z.string().optional().default('https://api.deepseek.com'),
  LLM_API_KEY: z.string().optional().default(''),
  LLM_MODEL: z.string().optional().default('deepseek-chat'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(6),
  AGENT_DAILY_QUOTA: z.coerce.number().int().positive().default(200),
  AGENT_ACTION_TTL_MS: z.coerce.number().int().positive().default(300000),
  SELF_BASE_URL: z.string().optional().default(''),

  // ---- 邮件（每日建议汇总）----
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.string().optional().default('true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default(''),
  SUGGESTION_DIGEST_TO: z.string().optional().default(''),

  // ---- 微信（iLink Bot API，普通微信个人号）----
  WEIXIN_ACCOUNT_ID: z.string().optional().default(''),
  WEIXIN_TOKEN: z.string().optional().default(''),
  WEIXIN_BASE_URL: z.string().optional().default('https://ilinkai.weixin.qq.com'),
  WEIXIN_CREDENTIALS_FILE: z.string().optional().default('/home/ayin/.class-mansys/weixin.json'),
  MAX_UPLOAD_SIZE: z.string().optional().default('5mb')
});

const parsed = schema.safeParse(process.env);
let env;

if (parsed.success) {
  env = parsed.data;
} else {
  const issues = parsed.error.issues.map((i) => '  - ' + (i.path.join('.') || '(root)') + ': ' + i.message).join('\n');
  console.error('[env] 环境变量校验失败：\n' + issues);
  if ((process.env.NODE_ENV || 'development') === 'production') {
    process.exit(1);
  }
  // 非生产环境尽量降级继续，便于本地开发
  env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT || 3000),
    DB_HOST: process.env.DB_HOST || '127.0.0.1',
    DB_PORT: Number(process.env.DB_PORT || 3306),
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_NAME: process.env.DB_NAME || 'class_manage_sys',
    JWT_SECRET: process.env.JWT_SECRET || '',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    OTP_PROVIDER: process.env.OTP_PROVIDER || '',
    OTP_DEBUG_CONSOLE: process.env.OTP_DEBUG_CONSOLE || '',
    LOG_LEVEL: process.env.LOG_LEVEL || '',
    UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
    APK_DIR: process.env.APK_DIR || './apk',
    UPLOAD_AUTH_MODE: process.env.UPLOAD_AUTH_MODE === 'compat' ? 'compat' : 'strict',
    AGENT_LLM_MODE: process.env.AGENT_LLM_MODE || 'auto',
    LLM_LOCAL_BASE_URL: process.env.LLM_LOCAL_BASE_URL || '',
    LLM_LOCAL_MODEL: process.env.LLM_LOCAL_MODEL || '',
    LLM_LOCAL_TIMEOUT_MS: Number(process.env.LLM_LOCAL_TIMEOUT_MS || 8000),
    LLM_PREFER: process.env.LLM_PREFER || 'local',
    LLM_BREAKER_THRESHOLD: Number(process.env.LLM_BREAKER_THRESHOLD || 3),
    LLM_BREAKER_COOLDOWN_MS: Number(process.env.LLM_BREAKER_COOLDOWN_MS || 60000),
    LLM_BASE_URL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    LLM_API_KEY: process.env.LLM_API_KEY || '',
    LLM_MODEL: process.env.LLM_MODEL || 'deepseek-chat',
    LLM_TIMEOUT_MS: Number(process.env.LLM_TIMEOUT_MS || 30000),
    AGENT_MAX_STEPS: Number(process.env.AGENT_MAX_STEPS || 6),
    AGENT_DAILY_QUOTA: Number(process.env.AGENT_DAILY_QUOTA || 200),
    AGENT_ACTION_TTL_MS: Number(process.env.AGENT_ACTION_TTL_MS || 300000),
    SELF_BASE_URL: process.env.SELF_BASE_URL || '',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: Number(process.env.SMTP_PORT || 465),
    SMTP_SECURE: process.env.SMTP_SECURE || 'true',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    MAIL_FROM: process.env.MAIL_FROM || '',
    SUGGESTION_DIGEST_TO: process.env.SUGGESTION_DIGEST_TO || '',
    WEIXIN_ACCOUNT_ID: process.env.WEIXIN_ACCOUNT_ID || '',
    WEIXIN_TOKEN: process.env.WEIXIN_TOKEN || '',
    WEIXIN_BASE_URL: process.env.WEIXIN_BASE_URL || 'https://ilinkai.weixin.qq.com',
    WEIXIN_CREDENTIALS_FILE: process.env.WEIXIN_CREDENTIALS_FILE || '/home/ayin/.class-mansys/weixin.json',
    MAX_UPLOAD_SIZE: process.env.MAX_UPLOAD_SIZE || '5mb'
  };
}

if (env.NODE_ENV === 'production' && env.JWT_SECRET.length < 16) {
  console.error('[env] 生产环境 JWT_SECRET 长度不足 16 位，拒绝启动');
  process.exit(1);
}

module.exports = { env, schema };
