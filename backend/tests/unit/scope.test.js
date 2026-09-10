import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { classScopeSql, canAccessClassRecord, filterByClassScope, canAccessOwnClassRecord, filterByOwnClassScope, buildSqlScopeFilters } = require('../../shared/scope');

describe('classScopeSql（可见区队 SQL 片段）', () => {
  it('visibleClassIds 为 null 时不过滤（超管/辅导员）', () => {
    expect(classScopeSql({ visibleClassIds: null }, 'n.class_id')).toBeNull();
  });

  it('空数组只允许全局内容', () => {
    expect(classScopeSql({ visibleClassIds: [] }, 'n.class_id')).toEqual({ sql: '(n.class_id IS NULL)', params: [] });
    expect(classScopeSql({ visibleClassIds: [] }, 'n.class_id', { includeGlobal: false })).toEqual({ sql: '1=0', params: [] });
  });

  it('非空数组生成 IN 且包含全局内容', () => {
    const r = classScopeSql({ visibleClassIds: ['6', '7'] }, 'n.class_id');
    expect(r.sql).toBe('(n.class_id IS NULL OR n.class_id IN (?,?))');
    expect(r.params).toEqual(['6', '7']);
  });

  it('includeGlobal=false 时不包含全局内容', () => {
    const r = classScopeSql({ visibleClassIds: ['6'] }, 'l.class_id', { includeGlobal: false });
    expect(r.sql).toBe('l.class_id IN (?)');
  });
});

describe('记录级可见性', () => {
  it('全局记录人人可见', () => {
    expect(canAccessClassRecord({ class_id: null }, { visibleClassIds: ['6'] })).toBe(true);
    expect(canAccessClassRecord({}, { visibleClassIds: ['6'] })).toBe(true);
  });

  it('本区队可见、他区队不可见', () => {
    expect(canAccessClassRecord({ class_id: '6' }, { visibleClassIds: ['6', '7'] })).toBe(true);
    expect(canAccessClassRecord({ class_id: '9' }, { visibleClassIds: ['6', '7'] })).toBe(false);
  });

  it('visibleClassIds=null 时全部可见', () => {
    expect(canAccessClassRecord({ class_id: '9' }, { visibleClassIds: null })).toBe(true);
  });

  it('filterByClassScope 只保留可见记录', () => {
    const rows = [{ class_id: '6' }, { class_id: '7' }, { class_id: null }, { class_id: '9' }];
    expect(filterByClassScope(rows, { visibleClassIds: ['6'] }).map((r) => r.class_id)).toEqual(['6', null]);
  });
});

describe('仅本区队（敏感模块口径）', () => {
  it('使用 classIds 而非 visibleClassIds', () => {
    const scope = { classIds: ['6'], visibleClassIds: ['6', '7'] };
    expect(canAccessOwnClassRecord({ class_id: '7' }, scope)).toBe(false);
    expect(canAccessOwnClassRecord({ class_id: '6' }, scope)).toBe(true);
    expect(filterByOwnClassScope([{ class_id: '6' }, { class_id: '7' }], scope).length).toBe(1);
  });

  it('超管（classIds=null）不受限', () => {
    expect(canAccessOwnClassRecord({ class_id: '9' }, { classIds: null })).toBe(true);
  });
});

describe('buildSqlScopeFilters', () => {
  it('无别名时不生成片段', () => {
    expect(buildSqlScopeFilters({ classIds: ['6'], companyId: '1', canViewCompany: true }, {})).toBeNull();
  });

  it('按区队 + 中队生成 AND 片段', () => {
    const r = buildSqlScopeFilters({ classIds: ['6'], companyId: '1', canViewCompany: true }, { class: 'u', company: 'c' });
    expect(r.where).toBe('u.id IN (?) AND c.company_id = ?');
    expect(r.params).toEqual(['6', '1']);
  });
});
