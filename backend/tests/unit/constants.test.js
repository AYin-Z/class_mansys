import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const constants = require('../../shared/constants');
const { ROLES, ADMIN_ROLE_IDS, COMPANY_VIEW_ROLE_IDS, isAdmin, hasRole, hasAnyRole, MEMBER_TYPES, isRosterMember } = constants;

describe('角色常量', () => {
  it('角色编码固定为 0-9', () => {
    expect(ROLES.STUDENT).toBe(0);
    expect(ROLES.CLASS_LEADER).toBe(1);
    expect(ROLES.PUBLICITY_COMMITTEE).toBe(7);
    expect(ROLES.SUPER_ADMIN).toBe(8);
    expect(ROLES.COUNSELOR).toBe(9);
  });

  it('干部集合为 1-9', () => {
    expect(ADMIN_ROLE_IDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(COMPANY_VIEW_ROLE_IDS).toEqual(ADMIN_ROLE_IDS);
  });

  it('isAdmin 只认 1-9', () => {
    expect(isAdmin({ role: 0 })).toBe(false);
    expect(isAdmin({ role: 1 })).toBe(true);
    expect(isAdmin({ role: 9 })).toBe(true);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin({ role: '8' })).toBe(true);
  });

  it('hasRole / hasAnyRole', () => {
    expect(hasRole({ role: 2 }, 2)).toBe(true);
    expect(hasRole({ role: '2' }, 2)).toBe(true);
    expect(hasRole({ role: 3 }, 2)).toBe(false);
    expect(hasAnyRole({ role: 7 }, [1, 7])).toBe(true);
    expect(hasAnyRole({ role: 0 }, [1, 7])).toBe(false);
  });
});

describe('在编身份 member_type（与 role 正交）', () => {
  it('student 计入花名册（含班干部）', () => {
    expect(isRosterMember({ role: 0, member_type: 'student' })).toBe(true);
    expect(isRosterMember({ role: 1, member_type: 'student' })).toBe(true);
    expect(isRosterMember({ role: 7, member_type: 'student' })).toBe(true);
  });

  it('staff/system 不计入花名册', () => {
    expect(isRosterMember({ role: 8, member_type: 'system' })).toBe(false);
    expect(isRosterMember({ role: 9, member_type: 'staff' })).toBe(false);
  });

  it('缺省视为 student（向后兼容）', () => {
    expect(isRosterMember({ role: 0 })).toBe(true);
    expect(isRosterMember(null)).toBe(false);
  });

  it('MEMBER_TYPES 取值稳定', () => {
    expect(MEMBER_TYPES.STUDENT).toBe('student');
    expect(MEMBER_TYPES.STAFF).toBe('staff');
    expect(MEMBER_TYPES.SYSTEM).toBe('system');
  });
});

describe('前后端角色定义一致性（防漂移）', () => {
  it('前端 roles.ts 的 USER_ROLES 与后端 ROLES 数值一致', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = path.resolve(process.cwd(), '..', 'frontend-v3', 'src', 'types', 'roles.ts');
    const src = fs.readFileSync(file, 'utf-8');
    const block = src.slice(src.indexOf('export const USER_ROLES'), src.indexOf('} as const', src.indexOf('export const USER_ROLES')));
    for (const [name, value] of Object.entries(ROLES)) {
      const re = new RegExp(name + '\\s*:\\s*(\\d+)');
      const m = block.match(re);
      expect(m, '前端缺少角色 ' + name).toBeTruthy();
      expect(Number(m[1]), '角色 ' + name + ' 数值不一致').toBe(value);
    }
  });
});
