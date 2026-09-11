import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const perms = require('../../shared/permissions');

const snapshot = perms.currentMatrix();

afterAll(() => { perms.setEffectiveMatrix(snapshot); });
beforeEach(() => { perms.setEffectiveMatrix(snapshot); });

describe('权限矩阵（可配置 + 兜底）', () => {
  it('默认矩阵包含全部权限键，且超管拥有 MANAGE_PERMISSIONS', () => {
    expect(perms.PERMISSION_KEYS.length).toBeGreaterThanOrEqual(29);
    expect(perms.PERMISSIONS.MANAGE_PERMISSIONS).toContain(8);
    expect(perms.hasPermission({ role: 8 }, 'MANAGE_PERMISSIONS')).toBe(true);
    expect(perms.hasPermission({ role: 1 }, 'MANAGE_PERMISSIONS')).toBe(false);
  });

  it('setEffectiveMatrix 后立即生效（无需重启）', () => {
    perms.setEffectiveMatrix({ MANAGE_PERMISSIONS: [8], VIEW_COMPANY: [8] });
    expect(perms.hasPermission({ role: 1 }, 'VIEW_COMPANY')).toBe(false);
    expect(perms.hasPermission({ role: 8 }, 'VIEW_COMPANY')).toBe(true);
    perms.setEffectiveMatrix({ MANAGE_PERMISSIONS: [8], VIEW_COMPANY: [1, 8] });
    expect(perms.hasPermission({ role: 1 }, 'VIEW_COMPANY')).toBe(true);
  });

  it('无法移除超管对 MANAGE_PERMISSIONS 的权限（防锁死）', () => {
    const normalized = perms.setEffectiveMatrix({ MANAGE_PERMISSIONS: [1] });
    expect(normalized.MANAGE_PERMISSIONS).toContain(8);
  });

  it('未知权限键/未登录一律拒绝', () => {
    expect(perms.hasPermission({ role: 8 }, 'NOT_A_PERMISSION')).toBe(false);
    expect(perms.hasPermission(null, 'VIEW_ROSTER')).toBe(false);
    expect(perms.hasPermission({}, 'VIEW_ROSTER')).toBe(false);
  });

  it('permissionsFor 返回该角色的权限快照', () => {
    perms.setEffectiveMatrix({ MANAGE_PERMISSIONS: [8], VIEW_ROSTER: [1, 8], APPROVE_LEAVE: [] });
    const snap = perms.permissionsFor(1);
    expect(snap.VIEW_ROSTER).toBe(true);
    expect(snap.APPROVE_LEAVE).toBe(false);
    expect(snap.MANAGE_PERMISSIONS).toBe(false);
    const adminSnap = perms.permissionsFor(8);
    expect(adminSnap.MANAGE_PERMISSIONS).toBe(true);
  });

  it('updatePermission 拒绝未知键与非超管操作者', async () => {
    await expect(perms.updatePermission('NOPE', [8], 8)).rejects.toThrow(/未知权限键/);
    await expect(perms.updatePermission('VIEW_ROSTER', [1], 1)).rejects.toThrow(/仅系统管理员/);
  });

  it('loadPermissions 在表为空时保持默认矩阵（不误清空）', async () => {
    const loaded = await perms.loadPermissions();
    // 测试库可能没有 role_permissions 表或没有数据，两种情况都必须安全
    expect(typeof loaded).toBe('boolean');
    expect(Object.keys(perms.currentMatrix()).length).toBeGreaterThanOrEqual(29);
  });
});
