#!/usr/bin/env node
/**
 * UI 冒烟用的固定测试账号（只在测试库执行）
 *
 * 为什么要它：CI 里的测试库是"克隆生产结构 + 少量参照数据"，没有稳定用户；
 * 而 UI 冒烟需要登录态（否则拿不到 TabBar，覆盖不到"点 tab 白屏"这类事故）。
 * 这里在**测试库**里 upsert 一个固定超管账号，并把 id 打印给 CI 使用。
 *
 * 安全：库名必须以 _test 结尾，否则直接拒绝执行（复用 tests/lib/dbGuard.js 的约定）。
 *
 * 用法：
 *   DB_NAME=class_manage_sys_test node tests/seed-smoke-user.js
 *   → 输出 SMOKE_USER_ID=123 SMOKE_USER_ROLE=8
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { isTestDbName } = require('./lib/dbGuard');
const db = require('../config/database');

const STUDENT_ID = process.env.SMOKE_STUDENT_ID || 'SMOKE0001';
const NAME = '冒烟测试账号';

(async () => {
  const dbName = process.env.DB_NAME || '';
  if (!isTestDbName(dbName)) {
    console.error(`拒绝执行：DB_NAME=${dbName} 不是测试库（必须以 _test 结尾）`);
    process.exit(1);
  }

  const [rows] = await db.query('SELECT id FROM users WHERE student_id = ? LIMIT 1', [STUDENT_ID]);
  let id;
  if (rows.length) {
    id = rows[0].id;
    await db.query('UPDATE users SET name = ?, role = 8, member_type = ? WHERE id = ?', [NAME, 'student', id]);
  } else {
    // users 表有一批 NOT NULL 且无默认值的列（openid/nickName/avatarUrl/class_id/phone/email），
    // 历史结构没有默认值，插入时必须显式给值
    const [result] = await db.query(
      `INSERT INTO users (name, student_id, role, member_type, openid, nickName, avatarUrl, class_id, phone, email)
       VALUES (?, ?, 8, 'student', ?, ?, '', '', '', '')`,
      [NAME, STUDENT_ID, `smoke_${STUDENT_ID}`, NAME]
    );
    id = result.insertId;
  }

  console.log(`SMOKE_USER_ID=${id}`);
  console.log('SMOKE_USER_ROLE=8');
  process.exit(0);
})().catch((err) => {
  console.error('seed-smoke-user 失败：', err.message);
  process.exit(1);
});
