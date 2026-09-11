'use strict';
/**
 * 测试库可用性探测（CI / 本地开发者体验）
 *
 * 背景：部分 API 用例（如 MCP 令牌校验）必须真的查库才能走到 401 分支；
 * 没有数据库时连接异常会被错误处理成 500，报错信息也看不出是环境问题。
 *
 * 规则：
 *   - CI（process.env.CI 为真）中**绝不跳过**：CI 已配置专用测试库
 *     （ci_runner @ class_manage_sys_test），连不上就该让流水线红，
 *     避免"静默跳过"掩盖真实回归。
 *   - 本地无库时跳过并打印原因，不阻塞 `npm test`。
 *
 * 连接信息与后端一致（DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME）。
 */
const mysql = require('mysql2/promise');

let cached = null;

/** 是否处于 CI（GitHub Actions 会注入 CI=true） */
function isCI() {
  const v = String(process.env.CI || '').toLowerCase();
  return v === 'true' || v === '1';
}

/** 探测数据库是否可连接（结果缓存，避免每个用例都连一次） */
async function dbReachable() {
  if (cached !== null) return cached;
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'class_manage_sys_test',
      connectTimeout: 2000
    });
    await conn.query('SELECT 1');
    await conn.end();
    cached = true;
  } catch (err) {
    cached = false;
    if (!isCI()) {
      console.warn(`[dbProbe] 测试库不可用（${err.code || err.message}），相关用例将跳过`);
    }
  }
  return cached;
}

/**
 * 生成用例收集器：库可用（或处于 CI）时是 describe，否则是 describe.skip。
 * 用法：const withDb = await dbSuite();  withDb('标题', () => { ... })
 */
async function dbSuite() {
  const up = await dbReachable();
  // 用 globalThis 取 vitest 注入的全局，避免 eslint no-undef（globals: true 只在 vitest 运行时生效）
  return up || isCI() ? globalThis.describe : globalThis.describe.skip;
}

module.exports = { dbReachable, dbSuite, isCI };
