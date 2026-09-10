import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { hashToken, generateToken } = require('../../services/apiToken');

describe('个人访问令牌', () => {
  it('hash 为 sha256 十六进制且稳定', () => {
    const h1 = hashToken('cm_abc');
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken('cm_abc')).toBe(h1);
    expect(hashToken('cm_abd')).not.toBe(h1);
  });

  it('生成令牌带 cm_ 前缀且不可预测/不重复', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.startsWith('cm_')).toBe(true);
    expect(a.length).toBeGreaterThan(40);
    expect(a).not.toBe(b);
  });
});
