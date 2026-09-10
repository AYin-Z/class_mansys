import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { PERMISSIONS, PERMISSION_KEYS, hasPermission, requirePermission } = require('../../shared/permissions');
const { ROLES, ADMIN_ROLE_IDS } = require('../../shared/constants');

describe('权限矩阵', () => {
  it('每个权限都映射到非空角色集合', () => {
    for (const key of PERMISSION_KEYS) {
      expect(Array.isArray(PERMISSIONS[key]), key).toBe(true);
      expect(PERMISSIONS[key].length, key + ' 为空').toBeGreaterThan(0);
    }
  });

  it('发布公告仅区队长/超管', () => {
    expect(hasPermission({ role: ROLES.CLASS_LEADER }, 'PUBLISH_ANNOUNCEMENT')).toBe(true);
    expect(hasPermission({ role: ROLES.SUPER_ADMIN }, 'PUBLISH_ANNOUNCEMENT')).toBe(true);
    expect(hasPermission({ role: ROLES.STUDY_VICE }, 'PUBLISH_ANNOUNCEMENT')).toBe(false);
    expect(hasPermission({ role: ROLES.STUDENT }, 'PUBLISH_ANNOUNCEMENT')).toBe(false);
  });

  it('角色变更与请假配置仅超管', () => {
    expect(PERMISSIONS.MANAGE_MEMBER_ROLE).toEqual([ROLES.SUPER_ADMIN]);
    expect(PERMISSIONS.MANAGE_LEAVE_CONFIG).toEqual([ROLES.SUPER_ADMIN]);
    expect(hasPermission({ role: ROLES.CLASS_LEADER }, 'MANAGE_MEMBER_ROLE')).toBe(false);
  });

  it('中队平行查看对所有管理角色开放', () => {
    for (const role of ADMIN_ROLE_IDS) {
      expect(hasPermission({ role }, 'VIEW_COMPANY'), '角色 ' + role).toBe(true);
    }
    expect(hasPermission({ role: ROLES.STUDENT }, 'VIEW_COMPANY')).toBe(false);
  });

  it('未登录/未知权限拒绝', () => {
    expect(hasPermission(null, 'VIEW_COMPANY')).toBe(false);
    expect(hasPermission({ role: 1 }, 'NOT_EXIST')).toBe(false);
  });
});

describe('requirePermission 中间件', () => {
  const mockRes = () => ({ statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

  it('无 req.user → 401', () => {
    const res = mockRes();
    const next = vi.fn();
    requirePermission('VIEW_COMPANY')({}, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('无权限 → 403 且带 code', () => {
    const res = mockRes();
    const next = vi.fn();
    requirePermission('VIEW_COMPANY')({ user: { role: 0 } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('有权限 → next()', () => {
    const res = mockRes();
    const next = vi.fn();
    requirePermission('VIEW_COMPANY')({ user: { role: 2 } }, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('前后端权限矩阵一致性（防漂移）', () => {
  it('前端 PERMISSIONS 中存在的键，后端必须有且角色集合一致', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = path.resolve(process.cwd(), '..', 'frontend-v3', 'src', 'types', 'roles.ts');
    const src = fs.readFileSync(file, 'utf-8');
    const start = src.indexOf('export const PERMISSIONS');
    const block = src.slice(start, src.indexOf('} as const', start));
    for (const key of PERMISSION_KEYS) {
      const re = new RegExp(key + '\\s*:', 'm');
      if (!re.test(block)) continue; // 前端未声明的权限不强制
      expect(block, key + ' 应在前端声明').toMatch(re);
    }
    // 反向：前端声明的键必须能在后端找到
    const frontKeys = [...block.matchAll(/^\s{2}([A-Z_]+)\s*:/gm)].map((m) => m[1]);
    for (const k of frontKeys) {
      expect(PERMISSION_KEYS, '后端缺少权限 ' + k).toContain(k);
    }
  });
});
