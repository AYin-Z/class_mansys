#!/usr/bin/env node
/**
 * 端到端验收用：把生产库结构克隆到独立测试库，并应用最新迁移 + 播种测试数据。
 * 用法：node tests/setup-test-db.js [testDbName]
 * 注意：只操作测试库，不触碰生产库数据。
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const SRC_DB = process.env.DB_NAME || 'class_manage_sys';
const TEST_DB = process.argv[2] || 'class_manage_sys_test';
const MIGRATIONS = ['008_add_suggestion_view_token.sql', '009_add_company.sql', '010_add_class_scope.sql', '011_add_user_member_type.sql', '012_add_agent.sql', '013_add_channel_and_tokens.sql', '014_add_api_token_scope.sql'];

function baseConn() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true
  };
}

function childEnv(extra) {
  return Object.assign({}, process.env, { DB_NAME: TEST_DB, NODE_ENV: 'test', SEED_FORCE: '1' }, extra);
}

(async () => {
  if (TEST_DB === SRC_DB) throw new Error('测试库名不能与生产库相同');
  const conn = await mysql.createConnection(baseConn());

  console.log('[1/5] 重建测试库 ' + TEST_DB);
  await conn.query('DROP DATABASE IF EXISTS `' + TEST_DB + '`');
  await conn.query('CREATE DATABASE `' + TEST_DB + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await conn.query('USE `' + TEST_DB + '`');
  await conn.query('SET FOREIGN_KEY_CHECKS=0');

  console.log('[2/5] 克隆生产库结构（表 + 视图）');
  const [objs] = await conn.query(
    'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_TYPE DESC, TABLE_NAME ASC',
    [SRC_DB]
  );
  const tables = objs.filter(o => o.TABLE_TYPE === 'BASE TABLE');
  const views = objs.filter(o => o.TABLE_TYPE === 'VIEW');
  for (const t of tables) {
    const [rows] = await conn.query('SHOW CREATE TABLE `' + SRC_DB + '`.`' + t.TABLE_NAME + '`');
    const ddl = rows[0]['Create Table'];
    await conn.query(ddl);
  }
  for (const v of views) {
    const [rows] = await conn.query('SHOW CREATE VIEW `' + SRC_DB + '`.`' + v.TABLE_NAME + '`');
    const ddl = rows[0]['Create View'];
    try { await conn.query(ddl); } catch (e) { console.log('  (跳过视图 ' + v.TABLE_NAME + ': ' + e.message + ')'); }
  }
  // 参照数据（非用户数据）：请假类型等配置必须与生产一致，否则测试用例会因缺配置失败
  const REFERENCE_TABLES = ['leave_config'];
  for (const t of REFERENCE_TABLES) {
    if (!tables.some(o => o.TABLE_NAME === t)) continue;
    await conn.query('INSERT INTO `' + t + '` SELECT * FROM `' + SRC_DB + '`.`' + t + '`');
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('  表 ' + tables.length + ' 个，视图 ' + views.length + ' 个（参照数据: ' + REFERENCE_TABLES.join(',') + '）');

  console.log('[3/5] 应用增量迁移');
  for (const m of MIGRATIONS) {
    const file = path.join(__dirname, '..', 'migrations', m);
    const sql = fs.readFileSync(file, 'utf-8');
    await conn.query(sql);
    console.log('  ✓ ' + m);
  }
  await conn.end();

  console.log('[4/5] 播种测试数据（seed.js --force）');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'seed.js'), '--force'], {
    cwd: path.join(__dirname, '..'),
    env: childEnv(),
    stdio: 'inherit'
  });

  console.log('[5/5] 创建测试中队并挂载区队');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'seed-company.js'), '1', '测试中队'], {
    cwd: path.join(__dirname, '..'),
    env: childEnv(),
    stdio: 'inherit'
  });

  console.log('\n✅ 测试库就绪: ' + TEST_DB);
})().catch(e => { console.error('SETUP_ERROR:', e.message); process.exit(1); });
