#!/usr/bin/env node
/**
 * 数据库迁移执行器（P0 工程化基座）
 *
 * 用法：
 *   node scripts/migrate.js status            查看已应用/待应用
 *   node scripts/migrate.js up                应用所有待执行迁移
 *   node scripts/migrate.js up --dry-run      只打印将要执行的迁移
 *
 * 约定：
 *   - 只管理 migrations/ 下形如 NNN_*.sql 的编号迁移（按文件名排序）
 *   - 通过 schema_migrations 表记录已应用文件与 sha256 校验和
 *   - 迁移必须幂等；若文件在应用后被修改（校验和不一致）会告警并跳过，需人工处理
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATION_RE = /^\d{3}_.*\.sql$/;

function connOptions() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'class_manage_sys',
    multipleStatements: true
  };
}

function listMigrations() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => MIGRATION_RE.test(f))
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      return { file, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
    });
}

async function ensureTable(conn) {
  await conn.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (' +
    '  id VARCHAR(128) PRIMARY KEY,' +
    '  checksum CHAR(64) NOT NULL,' +
    '  execution_ms INT DEFAULT NULL,' +
    '  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' +
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
  );
}

async function main() {
  const cmd = (process.argv[2] || 'status').toLowerCase();
  const dryRun = process.argv.includes('--dry-run');
  const conn = await mysql.createConnection(connOptions());
  await ensureTable(conn);

  const [rows] = await conn.query('SELECT id, checksum, applied_at FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.id, r]));
  const migrations = listMigrations();

  if (cmd === 'status') {
    console.log('迁移状态（数据库: ' + (process.env.DB_NAME || 'class_manage_sys') + '）');
    for (const m of migrations) {
      const rec = applied.get(m.file);
      if (!rec) console.log('  [pending] ' + m.file);
      else if (rec.checksum !== m.checksum) console.log('  [changed] ' + m.file + ' (已应用但文件被修改)');
      else console.log('  [applied] ' + m.file + '  @ ' + rec.applied_at.toISOString());
    }
    const pending = migrations.filter((m) => !applied.has(m.file)).length;
    console.log('待应用: ' + pending + ' / 共 ' + migrations.length);
    await conn.end();
    return;
  }

  if (cmd !== 'up') {
    console.error('未知命令: ' + cmd + '（可用: status | up）');
    await conn.end();
    process.exit(1);
  }

  let executed = 0;
  for (const m of migrations) {
    const rec = applied.get(m.file);
    if (rec && rec.checksum === m.checksum) continue;
    if (rec && rec.checksum !== m.checksum) {
      console.warn('[skip] ' + m.file + ' 已应用但文件被修改，跳过（请人工核对）');
      continue;
    }
    if (dryRun) {
      console.log('[dry-run] 将执行 ' + m.file);
      continue;
    }
    const startedAt = Date.now();
    try {
      await conn.query(m.sql);
      const ms = Date.now() - startedAt;
      await conn.query(
        'INSERT INTO schema_migrations (id, checksum, execution_ms) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), execution_ms = VALUES(execution_ms), applied_at = NOW()',
        [m.file, m.checksum, ms]
      );
      executed += 1;
      console.log('[ok] ' + m.file + ' (' + ms + 'ms)');
    } catch (e) {
      console.error('[fail] ' + m.file + ' -> ' + e.message);
      await conn.end();
      process.exit(1);
    }
  }
  console.log(dryRun ? 'dry-run 完成' : '迁移完成，本次执行 ' + executed + ' 个');
  await conn.end();
}

main().catch((e) => { console.error('MIGRATE_ERROR:', e.message); process.exit(1); });
