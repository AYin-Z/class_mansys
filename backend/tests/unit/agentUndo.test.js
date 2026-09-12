import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const undo = require('../../services/agent/undo');

describe('撤销：只对真有反向端点的操作提供', () => {
  it('发布通知 → 撤回通知', () => {
    const p = undo.planFor({ method: 'POST', path: '/api/notice/create', resultData: { success: true, data: { id: 8 } } });
    expect(p).toEqual(expect.objectContaining({ method: 'DELETE', path: '/api/notice/8', label: '撤回这条通知' }));
    expect(p.ttlMs).toBeGreaterThan(0);
  });

  it('加减积分 → 回滚积分（响应 id 在顶层也要认）', () => {
    const p = undo.planFor({ method: 'POST', path: '/api/points', resultData: { success: true, id: 42 } });
    expect(p.path).toBe('/api/points/42');
    expect(p.label).toContain('积分');
  });

  it('发布公告 / 作业 → 可撤销', () => {
    expect(undo.isUndoable('POST', '/api/announcement/create')).toBe(true);
    expect(undo.isUndoable('POST', '/api/homework')).toBe(true);
  });

  it('没有反向端点的操作不给假撤销按钮', () => {
    // 提交匿名建议没有删除端点——给一个点了没反应的按钮比没有更糟
    expect(undo.planFor({ method: 'POST', path: '/api/suggestion', resultData: { success: true, data: { id: 1 } } })).toBe(null);
    // 销假是 PUT，反向端点不存在
    expect(undo.planFor({ method: 'PUT', path: '/api/leave/cancel/3', resultData: { success: true } })).toBe(null);
    // 审批
    expect(undo.planFor({ method: 'PUT', path: '/api/leave/approve', resultData: { success: true } })).toBe(null);
  });

  it('拿不到新建资源 id 就不登记（不猜 id，否则会删错东西）', () => {
    expect(undo.planFor({ method: 'POST', path: '/api/notice/create', resultData: { success: true } })).toBe(null);
    expect(undo.planFor({ method: 'POST', path: '/api/notice/create', resultData: { success: true, data: { id: 0 } } })).toBe(null);
  });

  it('id 提取兼容多种响应形态', () => {
    expect(undo.extractId({ id: 3 })).toBe(3);
    expect(undo.extractId({ insertId: 4 })).toBe(4);
    expect(undo.extractId({ data: { id: 5 } })).toBe(5);
    expect(undo.extractId({})).toBe(null);
    expect(undo.extractId(null)).toBe(null);
  });
});
