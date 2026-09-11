import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const guard = require('../lib/dbGuard');

/**
 * 批次 3c：破坏性脚本护栏。
 * 背景：tests/setup-test-db.js 可以 DROP 任意库、tests/restore-db.js 无库名白名单 /
 * 无事务 / 时区敏感，历史上发生过误清库。这里对抽出的白名单函数做单元测试。
 */
describe('库名白名单（tests/lib/dbGuard.js）', () => {
  it('测试库必须以 _test 结尾（允许 _test2 这类并发分库）', () => {
    expect(guard.isTestDbName('class_manage_sys_test')).toBe(true);
    expect(guard.isTestDbName('class_manage_sys_test2')).toBe(true);
    expect(guard.isTestDbName('CLASS_MANAGE_SYS_TEST')).toBe(true);
    expect(guard.isTestDbName(' class_manage_sys_test ')).toBe(true);
    expect(guard.isTestDbName('class_manage_sys')).toBe(false);
    expect(guard.isTestDbName('test_class_manage_sys')).toBe(false);
    expect(guard.isTestDbName('class_manage_sys_test_bak')).toBe(false);
    expect(guard.isTestDbName('')).toBe(false);
    expect(guard.isTestDbName(null)).toBe(false);
    expect(guard.isTestDbName('class-manage-sys_test')).toBe(false);
  });

  it('assertTestDbName：生产库 / 空库名直接拒绝，合法测试库返回归一化库名', () => {
    expect(() => guard.assertTestDbName('class_manage_sys')).toThrow(/_test/);
    expect(() => guard.assertTestDbName('')).toThrow(/不能为空/);
    expect(guard.assertTestDbName(' class_manage_sys_test ')).toBe('class_manage_sys_test');
  });

  it('注入式/特殊字符标识符一律拒绝', () => {
    const evil = 'class_manage_sys_test`; DROP DATABASE class_manage_sys; --';
    expect(() => guard.assertTestDbName(evil)).toThrow(/非法字符/);
    expect(() => guard.assertSafeIdentifier('users`; DROP TABLE users; --', '表名')).toThrow(/非法字符/);
    expect(guard.assertSafeIdentifier(' fee_collections ')).toBe('fee_collections');
  });

  it('restore-db：仅 _test 库，或 --allow-prod-db=<同名库> 才放行', () => {
    expect(guard.assertRestorableDbName('class_manage_sys_test', [])).toBe('class_manage_sys_test');
    expect(() => guard.assertRestorableDbName('class_manage_sys', [])).toThrow(/allow-prod-db/);
    // 放行的库名必须与目标库完全一致，不能用一个开关放行任意库
    expect(() => guard.assertRestorableDbName('class_manage_sys', ['--allow-prod-db=other_db'])).toThrow(
      /allow-prod-db/
    );
    expect(guard.assertRestorableDbName('class_manage_sys', ['--allow-prod-db=class_manage_sys'])).toBe(
      'class_manage_sys'
    );
    expect(guard.parseAllowProdDb(['node', 'restore-db.js', '--allow-prod-db=class_manage_sys'])).toBe(
      'class_manage_sys'
    );
    expect(guard.parseAllowProdDb(['node', 'restore-db.js'])).toBe(null);
  });
});

describe('迁移清单动态读取（替代硬编码）', () => {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = guard.listMigrationFiles(migrationsDir);

  it('从 migrations/ 读取 NNN_*.sql 并按文件名排序', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toEqual([...files].sort());
    expect(files.every((f) => /^\d{3}_.*\.sql$/.test(f))).toBe(true);
  });

  it('包含 015/016 等后续迁移（历史硬编码清单缺这两个）', () => {
    expect(files.some((f) => f.startsWith('015'))).toBe(true);
    expect(files.some((f) => f.startsWith('016'))).toBe(true);
  });

  it('排除非 NNN_ 命名的历史脚本', () => {
    expect(files).not.toContain('2026-04-20-admin-members.sql');
  });
});

describe('017 迁移内容（批次 3c 数据一致性）', () => {
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/017_add_constraints_and_indexes.sql'), 'utf-8');

  it('覆盖审计要求的唯一键与缺失索引', () => {
    const names = [
      'uk_homework_user',
      'uk_challenge_user',
      'uk_fee_collection_batch',
      'uk_companies_name',
      'idx_users_member_type',
      'idx_leaves_status_cancel_end',
      'idx_expenses_status',
      'idx_expenses_created_at',
      'idx_fee_records_paid_at',
      'idx_notices_class_created'
    ];
    for (const n of names) expect(sql, n).toContain(n);
  });

  it('用 information_schema 预判 + PREPARE，保证可重复执行', () => {
    expect(sql).toMatch(/information_schema\.STATISTICS/);
    expect(sql).toMatch(/PREPARE stmt FROM @sql/);
    expect(sql).toMatch(/DEALLOCATE PREPARE stmt/);
    expect(sql).not.toMatch(/^\s*USE\s/im);
  });

  it('重复数据：homework/challenge 先去重再建键，fee/companies 跳过并告警', () => {
    expect(sql).toMatch(/DELETE h FROM homework_submissions/);
    expect(sql).toMatch(/DELETE a FROM challenge_applications/);
    expect(sql).toMatch(/017 告警: fee_collections/);
    expect(sql).toMatch(/017 告警: companies/);
  });
});

describe('脚本护栏回归（源码级约定）', () => {
  const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf-8');

  it('setup-test-db.js 使用 dbGuard 且不再硬编码迁移清单', () => {
    const src = read('tests/setup-test-db.js');
    expect(src).toMatch(/require\('\.\/lib\/dbGuard'\)/);
    expect(src).toMatch(/listMigrationFiles/);
    expect(src).not.toMatch(/const MIGRATIONS = \[/);
  });

  it('restore-db.js 具备库名白名单 / 单事务 / 东八区时区', () => {
    const src = read('tests/restore-db.js');
    expect(src).toMatch(/assertRestorableDbName/);
    expect(src).toMatch(/beginTransaction/);
    expect(src).toMatch(/rollback/);
    expect(src).toMatch(/time_zone/);
  });

  it('seed.js 清理阶段在单事务内且不再吞掉 DELETE 错误', () => {
    const src = read('seed.js');
    expect(src).toMatch(/beginTransaction/);
    expect(src).toMatch(/agent_conversations/);
    expect(src).toMatch(/notice_completions/);
  });
});
