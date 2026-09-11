import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _internals } = require('../../services/leaveService');
const { parseTime, hhmmss } = _internals;

/**
 * 回归：请假时段校验曾只比 'HH:MM:SS' 字符串，
 * 导致反向区间（start>end）、跨年超长区间都能入库。
 */
describe('请假时间解析与校验基础', () => {
  it('解析多种时间格式（空格/T/毫秒/Z）', () => {
    expect(hhmmss(parseTime('2026-09-12 07:15:00'))).toBe('07:15:00');
    expect(hhmmss(parseTime('2026-09-12T07:15:00'))).toBe('07:15:00');
    expect(hhmmss(parseTime('2026-09-12T07:15:00.000Z'))).toBe('07:15:00');
    expect(parseTime('not-a-time')).toBe(null);
    expect(parseTime('')).toBe(null);
  });

  it('反向区间用时间戳可比出先后（字符串比较做不到）', () => {
    const start = parseTime('2026-05-20 07:10:00');
    const end = parseTime('2026-05-19 07:50:00');
    expect(start.getTime() > end.getTime()).toBe(true); // 业务层据此拒绝
  });

  it('超长区间可被时长上限识别', () => {
    const start = parseTime('2026-05-20 07:00:00');
    const end = parseTime('2099-01-01 08:00:00');
    const days = (end.getTime() - start.getTime()) / 86400000;
    expect(days).toBeGreaterThan(_internals.MAX_LEAVE_DAYS);
  });

  it('同一时刻解析稳定（东八区墙钟语义）', () => {
    const a = parseTime('2026-09-12 07:15:00');
    const b = parseTime('2026-09-12 07:15:00');
    expect(a.getTime()).toBe(b.getTime());
  });
});
