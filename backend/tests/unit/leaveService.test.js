import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const LeaveService = require('../../services/leaveService');
const { BadRequestError } = require('../../shared/http');

describe('LeaveService（无需数据库的规则）', () => {
  it('缺少 type 直接抛 400', async () => {
    await expect(LeaveService.apply({ id: 1 }, {})).rejects.toBeInstanceOf(BadRequestError);
  });

  it('proofUrl 无文件时抛 400', () => {
    expect(() => LeaveService.proofUrl(null)).toThrow(BadRequestError);
  });

  it('proofUrl 返回受保护路径与元信息', () => {
    const r = LeaveService.proofUrl({ filename: 'a.jpg', originalname: '证明.jpg', size: 12 });
    expect(r.url).toBe('/uploads/leaves/a.jpg');
    expect(r.filename).toBe('证明.jpg');
    expect(r.size).toBe(12);
  });
});
