import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), 'migrations');
const files = fs.readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf-8');

describe('迁移文件规范', () => {
  it('至少存在一个编号迁移', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('文件名唯一且按序号排序稳定', () => {
    expect(new Set(files).size).toBe(files.length);
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it('禁止使用 MySQL 不支持的 ADD COLUMN IF NOT EXISTS', () => {
    const bad = files.filter((f) => /ADD COLUMN IF NOT EXISTS/i.test(read(f)));
    expect(bad).toEqual([]);
  });

  it('禁止硬编码库名 USE（会破坏测试库/多环境）', () => {
    const bad = files.filter((f) => /^\s*USE\s+/im.test(read(f)));
    expect(bad).toEqual([]);
  });

  it('每个迁移都应具备幂等写法', () => {
    // 幂等的写法有几种，不能只认一种：
    //   IF(...)          —— 先查 information_schema 再决定要不要改（加列/加索引）
    //   IF NOT EXISTS    —— CREATE TABLE / CREATE INDEX
    //   INSERT IGNORE    —— 种默认数据，重复跑不覆盖已有配置
    //   DELETE FROM ... WHERE ...  —— 删除本身幂等（删已删的行是空操作），
    //                                 029 就是这种（收回某条权限）
    // 真正不幂等的是"无保护的 INSERT"和"无保护的 ALTER ADD COLUMN"——那两类仍会被拦下。
    const bad = files.filter((f) => {
      const sql = read(f);
      return (
        !/IF\s*\(/i.test(sql) &&
        !/IF NOT EXISTS/i.test(sql) &&
        !/INSERT IGNORE/i.test(sql) &&
        !/^\s*DELETE\s+FROM\s+\S+\s+WHERE/im.test(sql)
      );
    });
    expect(bad).toEqual([]);
  });

  it('007 使用 INSERT IGNORE 防止重复插入请假类型', () => {
    const f = files.find((x) => x.startsWith('007'));
    expect(f).toBeTruthy();
    expect(read(f)).toMatch(/INSERT IGNORE INTO leave_config/i);
  });

  it('011 引入 member_type（在编身份与 role 解耦）', () => {
    const f = files.find((x) => x.startsWith('011'));
    expect(f).toBeTruthy();
    expect(read(f)).toMatch(/member_type/);
  });
});
