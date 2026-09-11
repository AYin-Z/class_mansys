const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/database');
const AdminController = require('../controllers/AdminController');
const AdminConsole = require('../services/adminConsole');
const RosterImport = require('../services/rosterImport');
const { AdminMembers } = require('../services/adminMembers');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, updatePermission, currentMatrix, PERMISSION_LABELS } = require('../shared/permissions');
const { validateBody } = require('../shared/validate');
const { schemas } = require('../shared/schemas');
const { asyncHandler, ok, NotFoundError, BadRequestError } = require('../shared/http');

const uploadXlsx = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============================================================
// 名册与操作记录（原有：控制器内按区队作用域过滤）
// ============================================================
router.get('/members', authenticateToken, requirePermission('VIEW_ROSTER'), AdminController.listMembers);
router.get('/members/:id', authenticateToken, requirePermission('VIEW_ROSTER'), AdminController.memberDetail);
router.get('/operations', authenticateToken, requirePermission('VIEW_ROSTER'), AdminController.recentOperations);

// 修改成员角色（仅超级管理员）
router.put('/members/:id/role', authenticateToken, requirePermission('MANAGE_MEMBER_ROLE'), AdminController.updateMemberRole);

// 请假类型配置（仅超级管理员）
router.get('/leave-config', authenticateToken, requirePermission('MANAGE_LEAVE_CONFIG'), AdminController.getLeaveConfig);
router.put('/leave-config/:id', authenticateToken, requirePermission('MANAGE_LEAVE_CONFIG'), validateBody(schemas.leaveConfigUpdate), AdminController.updateLeaveConfig);

// ============================================================
// 控制台：总览 / 待办 / Agent 与渠道
// ============================================================
router.get('/console/overview', authenticateToken, requirePermission('VIEW_ROSTER'), asyncHandler(async (req, res) => {
  return ok(res, await AdminConsole.overview());
}));

router.get('/console/todos', authenticateToken, requirePermission('VIEW_ROSTER'), asyncHandler(async (req, res) => {
  return ok(res, { items: await AdminConsole.todos() });
}));

router.get('/console/agent', authenticateToken, requirePermission('VIEW_SYSTEM'), asyncHandler(async (req, res) => {
  return ok(res, await AdminConsole.agentPanel());
}));

// ============================================================
// 成员管理（增 / 改 / 重置密码 / 移出恢复 / 无历史删除 / 批量）
// ============================================================
router.post('/members', authenticateToken, requirePermission('MANAGE_MEMBERS'), validateBody(schemas.adminMemberCreate), asyncHandler(async (req, res) => {
  const result = await AdminMembers.create(req.body);
  return ok(res, result, { message: '已创建成员，初始密码：' + result.defaultPassword });
}));

router.put('/members/:id', authenticateToken, requirePermission('MANAGE_MEMBERS'), validateBody(schemas.adminMemberUpdate), asyncHandler(async (req, res) => {
  const updated = await AdminMembers.update(Number(req.params.id), req.body);
  return ok(res, updated, { message: '已保存' });
}));

router.post('/members/:id/reset-password', authenticateToken, requirePermission('MANAGE_MEMBERS'), validateBody(schemas.adminMemberResetPassword), asyncHandler(async (req, res) => {
  const result = await AdminMembers.resetPassword(Number(req.params.id), req.body.password);
  return ok(res, result, { message: '新密码：' + result.password });
}));

router.post('/members/:id/status', authenticateToken, requirePermission('MANAGE_MEMBERS'), validateBody(schemas.adminMemberStatus), asyncHandler(async (req, res) => {
  const result = await AdminMembers.setStatus(Number(req.params.id), req.body.status);
  return ok(res, result, { message: req.body.status === 'left' ? '已移出统计（历史保留）' : '已恢复在队' });
}));

router.delete('/members/:id', authenticateToken, requirePermission('MANAGE_MEMBERS'), asyncHandler(async (req, res) => {
  const result = await AdminMembers.remove(Number(req.params.id));
  return ok(res, result, { message: '已删除（该账号无历史数据）' });
}));

router.post('/members/bulk', authenticateToken, requirePermission('MANAGE_MEMBERS'), validateBody(schemas.adminMemberBulk), asyncHandler(async (req, res) => {
  const result = await AdminMembers.bulk(req.body);
  return ok(res, result, { message: '批量完成：成功 ' + result.done + ' / ' + result.total });
}));

// ============================================================
// 区队与中队
// ============================================================
router.get('/classes', authenticateToken, requirePermission('VIEW_ROSTER'), asyncHandler(async (req, res) => {
  const [classes] = await db.query(
    'SELECT c.id, c.name, c.company_id, co.name AS company_name, ' +
    "COUNT(CASE WHEN u.member_type = 'student' THEN 1 END) AS students, " +
    "COUNT(CASE WHEN u.member_type = 'left' THEN 1 END) AS lefts, " +
    "COUNT(CASE WHEN u.member_type = 'student' AND u.role BETWEEN 1 AND 7 THEN 1 END) AS cadres " +
    'FROM classes c LEFT JOIN users u ON u.class_id = c.id LEFT JOIN companies co ON co.id = c.company_id ' +
    'GROUP BY c.id, c.name, c.company_id, co.name ORDER BY c.id'
  );
  const [companies] = await db.query('SELECT id, name FROM companies ORDER BY id');
  const [leaders] = await db.query(
    "SELECT class_id, name FROM users WHERE member_type = 'student' AND role = 1 ORDER BY class_id"
  );
  return ok(res, { classes, companies, leaders });
}));

router.post('/classes', authenticateToken, requirePermission('MANAGE_MEMBERS'), validateBody(schemas.adminClassCreate), asyncHandler(async (req, res) => {
  const [[dup]] = await db.query('SELECT id FROM classes WHERE id = ?', [req.body.id]);
  if (dup) throw new BadRequestError('区队编号已存在：' + req.body.id);
  let companyId = req.body.company_id;
  if (!companyId) {
    const [[co]] = await db.query('SELECT id FROM companies ORDER BY id LIMIT 1');
    companyId = co ? co.id : null;
  }
  if (!companyId) throw new BadRequestError('请先创建中队');
  await db.query('INSERT INTO classes (id, name, company_id) VALUES (?, ?, ?)', [req.body.id, req.body.name, companyId]);
  return ok(res, { id: req.body.id, name: req.body.name, company_id: companyId }, { message: '区队已创建' });
}));

router.put('/classes/:id', authenticateToken, requirePermission('MANAGE_MEMBERS'), validateBody(schemas.adminClassUpdate), asyncHandler(async (req, res) => {
  const [[cls]] = await db.query('SELECT id FROM classes WHERE id = ?', [req.params.id]);
  if (!cls) throw new NotFoundError('区队不存在');
  const fields = [];
  const params = [];
  if (req.body.name) { fields.push('name = ?'); params.push(req.body.name); }
  if (req.body.company_id) { fields.push('company_id = ?'); params.push(req.body.company_id); }
  if (!fields.length) throw new BadRequestError('没有需要更新的字段');
  params.push(req.params.id);
  await db.query('UPDATE classes SET ' + fields.join(', ') + ' WHERE id = ?', params);
  return ok(res, { id: req.params.id }, { message: '已保存' });
}));

router.put('/companies/:id', authenticateToken, requirePermission('MANAGE_MEMBERS'), asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw new BadRequestError('中队名称不能为空');
  const [r] = await db.query('UPDATE companies SET name = ? WHERE id = ?', [name, req.params.id]);
  if (!r.affectedRows) throw new NotFoundError('中队不存在');
  return ok(res, { id: req.params.id, name }, { message: '已保存' });
}));

// ============================================================
// 名册导入（上传成绩表 → 预览 diff → 应用）
// ============================================================
router.post('/roster/preview', authenticateToken, requirePermission('MANAGE_MEMBERS'), uploadXlsx.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('请上传 .xlsx 文件');
  const result = await RosterImport.preview(req.file.buffer);
  return ok(res, result);
}));

router.post('/roster/apply', authenticateToken, requirePermission('MANAGE_MEMBERS'), uploadXlsx.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('请上传 .xlsx 文件');
  const result = await RosterImport.apply(req.file.buffer, req.user.id);
  return ok(res, result, { message: '导入完成：新增 ' + result.summary.create + '，更新 ' + result.summary.update + '，移出 ' + result.summary.leave });
}));

// ============================================================
// 审计日志
// ============================================================
router.get('/audit', authenticateToken, requirePermission('VIEW_SYSTEM'), asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '50', 10), 1), 200);
  const where = [];
  const params = [];
  if (req.query.userId) { where.push('o.user_id = ?'); params.push(Number(req.query.userId)); }
  if (req.query.keyword) {
    where.push('(o.action LIKE ? OR o.path LIKE ? OR u.name LIKE ? OR u.student_id LIKE ?)');
    const kw = '%' + req.query.keyword + '%';
    params.push(kw, kw, kw, kw);
  }
  if (req.query.method) { where.push('o.method = ?'); params.push(String(req.query.method).toUpperCase()); }
  if (req.query.status) { where.push('o.status_code = ?'); params.push(Number(req.query.status)); }
  if (req.query.from) { where.push('o.created_at >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('o.created_at <= ?'); params.push(req.query.to); }
  if (req.query.errorsOnly === '1') where.push('o.status_code >= 500');
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(
    'SELECT o.id, o.user_id, o.action, o.resource_type, o.resource_id, o.method, o.path, o.status_code, o.ip, o.created_at, ' +
    'u.name AS user_name, u.student_id, u.class_id ' +
    'FROM operation_logs o LEFT JOIN users u ON u.id = o.user_id ' + whereSql +
    ' ORDER BY o.id DESC LIMIT ? OFFSET ?',
    [...params, pageSize, (page - 1) * pageSize]
  );
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM operation_logs o LEFT JOIN users u ON u.id = o.user_id ' + whereSql, params
  );
  const [[stats]] = await db.query(
    'SELECT COUNT(*) AS all_count, SUM(status_code >= 400) AS errors, SUM(status_code >= 500) AS server_errors ' +
    'FROM operation_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
  );
  return ok(res, { page, pageSize, total, rows, stats24h: stats });
}));

router.get('/audit/export', authenticateToken, requirePermission('VIEW_SYSTEM'), asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '5000', 10), 20000);
  const [rows] = await db.query(
    'SELECT o.id, o.created_at, u.name AS user_name, u.student_id, o.method, o.path, o.status_code, o.ip, o.action ' +
    'FROM operation_logs o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT ?', [limit]
  );
  const header = ['id', '时间', '姓名', '学号', '方法', '路径', '状态码', 'IP', '动作'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.id, r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at, r.user_name || '', r.student_id || '', r.method, r.path, r.status_code, r.ip || '', (r.action || '').replace(/,/g, '；')].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
  return res.send('\ufeff' + lines.join('\n'));
}));

// ============================================================
// 系统状态 / 备份 / 导出
// ============================================================
router.get('/system/status', authenticateToken, requirePermission('VIEW_SYSTEM'), asyncHandler(async (req, res) => {
  return ok(res, await AdminConsole.systemStatus());
}));

router.post('/system/backup', authenticateToken, requirePermission('VIEW_SYSTEM'), asyncHandler(async (req, res) => {
  const result = await AdminConsole.runBackup();
  return ok(res, result, { message: result.ok ? '备份完成' : '备份失败，请查看输出' });
}));

router.get('/export/roster.csv', authenticateToken, requirePermission('VIEW_ROSTER'), asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    "SELECT u.student_id, u.name, u.class_id, c.name AS class_name, u.role, u.duty_note, u.member_type, u.phone, u.email " +
    'FROM users u LEFT JOIN classes c ON c.id = u.class_id ' +
    "WHERE u.member_type <> 'left' ORDER BY u.class_id, u.student_id"
  );
  const labels = { 0: '学员', 1: '区队长', 2: '生活副区', 3: '学习副区', 4: '心理副区', 5: '团支书', 6: '组织委员', 7: '宣传委员', 8: '系统管理员', 9: '辅导员' };
  const lines = ['学号,姓名,区队,职务,备注,类型,手机,邮箱'];
  for (const r of rows) {
    lines.push([r.student_id, r.name, r.class_name || r.class_id, labels[r.role] || r.role, r.duty_note || '', r.member_type, r.phone || '', r.email || ''].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="roster.csv"');
  return res.send('\ufeff' + lines.join('\n'));
}));

router.get('/export/roster.xlsx', authenticateToken, requirePermission('VIEW_ROSTER'), asyncHandler(async (req, res) => {
  const XLSX = require('xlsx');
  const [classes] = await db.query('SELECT id, name FROM classes ORDER BY id');
  const [users] = await db.query(
    "SELECT u.student_id, u.name, u.class_id, u.role, u.duty_note, u.member_type FROM users u " +
    "WHERE u.member_type <> 'left' ORDER BY u.class_id, u.student_id"
  );
  const labels = { 0: '学员', 1: '区队长', 2: '生活副区', 3: '学习副区', 4: '心理副区', 5: '团支书', 6: '组织委员', 7: '宣传委员', 8: '系统管理员', 9: '辅导员' };
  const wb = XLSX.utils.book_new();
  for (const c of classes) {
    const rows = [['学号', '姓名', '职务', '备注', '类型']];
    for (const u of users) {
      if (String(u.class_id) !== String(c.id)) continue;
      rows.push([u.student_id, u.name, labels[u.role] || u.role, u.duty_note || '', u.member_type]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), c.name.slice(0, 28));
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="roster.xlsx"');
  return res.send(buf);
}));

// ============================================================
// 权限矩阵（可配置）
// ============================================================
router.get('/permissions', authenticateToken, requirePermission('MANAGE_PERMISSIONS'), asyncHandler(async (req, res) => {
  const { PERMISSION_KEYS, PERMISSIONS } = require('../shared/permissions');
  const matrix = currentMatrix();
  const keys = PERMISSION_KEYS.map((key) => ({
    key,
    label: PERMISSION_LABELS[key] || key,
    roles: (matrix[key] || []).slice().sort((a, b) => a - b),
    defaultRoles: (PERMISSIONS[key] || []).slice().sort((a, b) => a - b)
  }));
  return ok(res, { keys });
}));

router.put('/permissions/:key', authenticateToken, requirePermission('MANAGE_PERMISSIONS'), validateBody(schemas.adminPermissionUpdate), asyncHandler(async (req, res) => {
  try {
    const roles = await updatePermission(req.params.key, req.body.roles, req.user.role);
    return ok(res, { key: req.params.key, roles }, { message: '权限已更新' });
  } catch (e) {
    throw new BadRequestError(e.message);
  }
}));

module.exports = router;
