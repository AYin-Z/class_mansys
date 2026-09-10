const { hasCompanyView, isAdmin } = require('./constants');
const Company = require('../models/Company');
const User = require('../models/User');

/**
 * 解析当前用户的作用域，为多区队/中队化提供权限地基。
 *
 * 返回值：
 *  - classId: 用户所属区队 id（可为 null）
 *  - classIds: 允许操作的区队 id 数组；null 表示不限（超管/辅导员）
 *  - companyId: 用户所属中队 id（可为 null；超管/辅导员为 null=不限）
 *  - canViewCompany: 是否可平行查看中队（跨区队）情况
 *  - isManagement: 是否为本区队管理层
 */
async function resolveScope(user) {
  if (!user) {
    return { classId: null, classIds: [], companyId: null, canViewCompany: false, isManagement: false };
  }
  // JWT 可能未携带 class_id，从 DB 补全（保证区队/中队作用域准确）
  if (!user.class_id || !user.role) {
    try {
      const fresh = await User.findById(user.id);
      if (fresh) {
        user = { ...user, class_id: fresh.class_id, role: fresh.role };
      }
    } catch (_) { /* fallback to token data */ }
  }
  const role = Number(user.role);
  const classIdObj = user.class_id ? String(user.class_id) : null;
  const classId = classIdObj && classIdObj !== '0' ? classIdObj : null;
  const isManagement = isAdmin(user);
  const canViewCompany = hasCompanyView(user);

  let classIds = null;
  if (role >= 1 && role <= 7) {
    // 区队管理层：作用域限本区队
    classIds = classId ? [classId] : [];
  } else if (role === 0) {
    // 普通学员：作用域限本人所在区队
    classIds = classId ? [classId] : [];
  }

  let companyId = null;
  if (classId) {
    try {
      companyId = await Company.findCompanyIdByClassId(classId);
    } catch (_) {
      companyId = null;
    }
  }

  // 可见区队集合：null = 不限（超管/辅导员）；数组 = 仅这些区队 + 全局(class_id IS NULL)内容
  let visibleClassIds;
  if (role >= 8) {
    visibleClassIds = null;
  } else if (canViewCompany && companyId) {
    try {
      const companyClasses = await Company.getClassesByCompany(companyId);
      visibleClassIds = companyClasses.map(c => c.class_id);
    } catch (_) {
      visibleClassIds = classIds ? classIds.slice() : [];
    }
  } else {
    visibleClassIds = classIds ? classIds.slice() : [];
  }

  // 写入归属：超管/辅导员发布的内容视为全局（NULL）；其余归本区队
  const writeClassId = role >= 8 ? null : (classId || null);

  return { classId, classIds, companyId, canViewCompany, isManagement, visibleClassIds, writeClassId };
}

/**
 * 为 SQL 生成“区队可见性”过滤片段。
 * @param {object} scope resolveScope 的返回值
 * @param {string} columnExpr 例如 'n.class_id'
 * @returns {{sql:string, params:any[]}|null} null 表示不过滤（超管/辅导员）
 */
function classScopeSql(scope, columnExpr, opts) {
  const includeGlobal = !opts || opts.includeGlobal !== false;
  const cols = scope && Array.isArray(scope.visibleClassIds) ? scope.visibleClassIds : null;
  if (cols === null) return null;
  if (cols.length === 0) {
    return includeGlobal ? { sql: '(' + columnExpr + ' IS NULL)', params: [] } : { sql: '1=0', params: [] };
  }
  const ph = cols.map(() => '?').join(',');
  const sql = includeGlobal
    ? '(' + columnExpr + ' IS NULL OR ' + columnExpr + ' IN (' + ph + '))'
    : columnExpr + ' IN (' + ph + ')';
  return { sql, params: cols.slice() };
}

/** 构建“区队/中队”作用的 WHERE 片段；scope 不限制时返回 null（表示不加该过滤） */
function buildSqlScopeFilters(scope, aliases) {
  const clauses = [];
  const params = [];
  const classAlias = aliases.class || null;
  const companyAlias = aliases.company || null;
  if (Array.isArray(scope.classIds) && scope.classIds.length > 0 && classAlias) {
    const ph = scope.classIds.map(() => '?').join(',');
    clauses.push(classAlias + '.id IN (' + ph + ')');
    params.push(...scope.classIds);
  }
  if (scope.canViewCompany && scope.companyId && companyAlias) {
    // 平行查看中队：若用户明确属于某中队，则限定该中队；否则不限定
    clauses.push(companyAlias + '.company_id = ?');
    params.push(scope.companyId);
  }
  return clauses.length ? { where: clauses.join(' AND '), params } : null;
}

/** 判断一条含 class_id 的记录当前用户是否可见（NULL=全局可见） */
function canAccessClassRecord(row, scope) {
  const cols = scope && Array.isArray(scope.visibleClassIds) ? scope.visibleClassIds : null;
  if (cols === null) return true;
  const cid = row && row.class_id != null && row.class_id !== '' ? String(row.class_id) : null;
  if (!cid) return true;
  return cols.includes(cid);
}

/** 按区队可见性过滤列表（行需包含 class_id 字段） */
function filterByClassScope(rows, scope) {
  if (!Array.isArray(rows)) return rows;
  const cols = scope && Array.isArray(scope.visibleClassIds) ? scope.visibleClassIds : null;
  if (cols === null) return rows;
  return rows.filter(r => canAccessClassRecord(r, scope));
}

/** 仅本区队可见（不享受中队平行）：用于心理、消息、班费等敏感模块 */
function canAccessOwnClassRecord(row, scope) {
  const cols = scope && Array.isArray(scope.classIds) ? scope.classIds : null;
  if (cols === null) return true; // 超管/辅导员
  const cid = row && row.class_id != null && row.class_id !== '' ? String(row.class_id) : null;
  if (!cid) return true; // 全局
  return cols.includes(cid);
}

function filterByOwnClassScope(rows, scope) {
  if (!Array.isArray(rows)) return rows;
  const cols = scope && Array.isArray(scope.classIds) ? scope.classIds : null;
  if (cols === null) return rows;
  return rows.filter(r => canAccessOwnClassRecord(r, scope));
}

module.exports = { resolveScope, buildSqlScopeFilters, classScopeSql, canAccessClassRecord, filterByClassScope, canAccessOwnClassRecord, filterByOwnClassScope };
