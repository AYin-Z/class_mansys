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
    const bad = files.filter((f) => {
      const sql = read(f);
      return !/IF\s*\(/i.test(sql) && !/IF NOT EXISTS/i.test(sql) && !/INSERT IGNORE/i.test(sql);
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
