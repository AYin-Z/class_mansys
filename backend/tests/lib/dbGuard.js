/**
 * 破坏性数据库脚本的库名 / 标识符护栏（批次 3c 数据安全）
 *
 * 供两个高风险脚本复用：
 *   - tests/setup-test-db.js：会 DROP DATABASE 并重建测试库
 *   - tests/restore-db.js：会 DELETE 全表并回灌备份
 *
 * 本文件是纯函数（只依赖 node:fs），不连数据库，便于单元测试与复用。
 */
'use strict';

const fs = require('fs');

// 库名/标识符只允许 字母、数字、下划线（拼接进 SQL 前必须过这一关，避免注入与误操作）
const DB_NAME_RE = /^[A-Za-z0-9_]+$/;
// 测试库约定：必须以 _test 结尾（允许 _test2 这类并发分库，与 tests/fixtures.js 的约定一致）
const TEST_DB_SUFFIX_RE = /_test[0-9]*$/i;
// 迁移文件约定：NNN_*.sql（历史脚本 2026-04-20-admin-members.sql 不符合命名约定，自动排除）
const MIGRATION_FILE_RE = /^\d{3}_.*\.sql$/;
// 显式放行非测试库的开关：--allow-prod-db=<name>
const ALLOW_PROD_DB_FLAG = '--allow-prod-db=';

function normalizeDbName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

/** 库名是否为合法标识符（非空 + 仅字母数字下划线） */
function isValidDbName(name) {
  return DB_NAME_RE.test(normalizeDbName(name));
}

/** 是否为测试库（合法标识符且以 _test 结尾） */
function isTestDbName(name) {
  const n = normalizeDbName(name);
  return DB_NAME_RE.test(n) && TEST_DB_SUFFIX_RE.test(n);
}

/** 解析 --allow-prod-db=<name>，未指定返回 null */
function parseAllowProdDb(argv) {
  const hit = (argv || []).find((a) => typeof a === 'string' && a.startsWith(ALLOW_PROD_DB_FLAG));
  return hit ? normalizeDbName(hit.slice(ALLOW_PROD_DB_FLAG.length)) : null;
}

/** 校验表名/列名等标识符，非法直接抛错（返回值便于链式使用） */
function assertSafeIdentifier(name, label) {
  const n = normalizeDbName(name);
  if (!n) throw new Error((label || '标识符') + '不能为空');
  if (!DB_NAME_RE.test(n)) throw new Error((label || '标识符') + '含非法字符（仅允许字母/数字/下划线）: ' + n);
  return n;
}

/** 只允许测试库：用于 setup-test-db.js（会 DROP 库） */
function assertTestDbName(name, label) {
  const n = normalizeDbName(name);
  if (!n) throw new Error((label || '测试库名') + '不能为空');
  if (!DB_NAME_RE.test(n)) throw new Error((label || '测试库名') + '含非法字符（仅允许字母/数字/下划线）: ' + n);
  if (!isTestDbName(n)) {
    throw new Error((label || '测试库名') + '必须以 _test 结尾，拒绝执行破坏性操作（当前: ' + n + '）');
  }
  return n;
}

/** 允许测试库，或经 --allow-prod-db=<同名库> 显式放行：用于 restore-db.js */
function assertRestorableDbName(name, argv, label) {
  const tag = label || '恢复目标库名';
  const n = normalizeDbName(name);
  if (!n) throw new Error(tag + '不能为空');
  if (!DB_NAME_RE.test(n)) throw new Error(tag + '含非法字符（仅允许字母/数字/下划线）: ' + n);
  if (isTestDbName(n)) return n;
  const allowed = parseAllowProdDb(argv);
  if (allowed && allowed === n) return n;
  throw new Error(tag + '不是 _test 测试库（当前: ' + n + '）；如确需恢复生产库，请显式追加 --allow-prod-db=' + n);
}

/** 列出迁移目录下的编号迁移（NNN_*.sql，按文件名排序），替代硬编码清单 */
function listMigrationFiles(migrationsDir) {
  return fs.readdirSync(migrationsDir)
    .filter((f) => MIGRATION_FILE_RE.test(f))
    .sort();
}

module.exports = {
  DB_NAME_RE,
  TEST_DB_SUFFIX_RE,
  MIGRATION_FILE_RE,
  ALLOW_PROD_DB_FLAG,
  normalizeDbName,
  isValidDbName,
  isTestDbName,
  parseAllowProdDb,
  assertSafeIdentifier,
  assertTestDbName,
  assertRestorableDbName,
  listMigrationFiles
};
