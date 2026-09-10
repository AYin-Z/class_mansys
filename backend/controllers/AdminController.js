const db = require('../config/database');
const User = require('../models/User');
const OperationLog = require('../models/OperationLog');
const LeaveConfig = require('../models/LeaveConfig');
const { ROLES } = require('../shared/constants');
const { resolveScope } = require('../shared/scope');

/**
 * 管理员后台相关接口：成员列表 + 成员详情
 */
class AdminController {
  /**
   * GET /api/admin/members
   * 查询参数：class_id、keyword、page、pageSize
   * 返回字段：id, name, student_id, class_id, class_name, role, phone, email,
   *          avatarUrl, gender, created_at,
   *          active_leave(当前未销假/审批中的请假简要), leave_count, last_action_at
   */
  static async listMembers(req, res) {
    try {
      const { class_id, keyword } = req.query;
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '50', 10), 1), 200);
      const offset = (page - 1) * pageSize;

      const where = [];
      const params = [];
      // 作用域：区队管理层只看本中队/本区队，超管/辅导员不限
      // 名册含 PII，仅限本区队（不做中队平行）
      const scope = await resolveScope(req.user);
      if (Array.isArray(scope.classIds)) {
        if (scope.classIds.length === 0) {
          where.push('1 = 0');
        } else {
          where.push('u.class_id IN (' + scope.classIds.map(() => '?').join(',') + ')');
          params.push(...scope.classIds);
        }
      }
      if (class_id) { where.push('u.class_id = ?'); params.push(class_id); }
      if (keyword) {
        where.push('(u.name LIKE ? OR u.student_id LIKE ? OR u.phone LIKE ?)');
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await db.query(
        `SELECT
            u.id, u.name, u.nickName, u.student_id, u.class_id, c.name AS class_name,
            u.role, u.phone, u.email, u.avatarUrl, u.gender, u.created_at,
            (
              SELECT COUNT(*) FROM leaves l WHERE l.user_id = u.id
            ) AS leave_count,
            (
              SELECT COUNT(*) FROM leaves l
              WHERE l.user_id = u.id AND l.is_cancelled = 0 AND l.status = 1
                    AND l.end_time >= NOW()
            ) AS active_leave_count,
            (
              SELECT MAX(o.created_at) FROM operation_logs o WHERE o.user_id = u.id
            ) AS last_action_at
         FROM users u
         LEFT JOIN classes c ON c.id = u.class_id
         ${whereSql}
         ORDER BY u.id ASC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      const [[{ total }]] = await db.query(
        `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
        params
      );

      res.json({ success: true, page, pageSize, total, members: rows });
    } catch (e) {
      console.error('listMembers failed:', e);
      res.status(500).json({ success: false, error: '获取成员列表失败' });
    }
  }

  /**
   * GET /api/admin/members/:id
   * 返回：
   *   user  —— 成员基础信息（含班级名）
   *   leaves —— 最近 10 条请假
   *   active_leave —— 当前生效中的请假（审批通过且未结束、未销假）
   *   operations —— 最近 20 条操作记录
   *   stats —— 聚合指标（请假总数、通过数、总积分）
   */
  static async memberDetail(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, error: '无效的成员 ID' });
      }
      const [[user]] = await db.query(
        `SELECT u.id, u.name, u.nickName, u.student_id, u.class_id, c.name AS class_name,
                u.role, u.phone, u.email, u.avatarUrl, u.gender, u.openid, u.created_at, u.updated_at
         FROM users u
         LEFT JOIN classes c ON c.id = u.class_id
         WHERE u.id = ?`,
        [id]
      );
      if (!user) return res.status(404).json({ success: false, error: '成员不存在' });
      const detailScope = await resolveScope(req.user);
      if (Array.isArray(detailScope.classIds) && !detailScope.classIds.includes(String(user.class_id))) {
        return res.status(403).json({ success: false, error: '无权查看其他区队成员' });
      }

      const [leaves] = await db.query(
        `SELECT id, leave_type, start_time, end_time, reason, status,
                approver_id, approval_time, approval_notes,
                is_cancelled, cancelled_time, created_at
         FROM leaves
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 10`,
        [id]
      );

      const [[activeLeave]] = await db.query(
        `SELECT id, leave_type, start_time, end_time, reason, status, created_at
         FROM leaves
         WHERE user_id = ? AND is_cancelled = 0 AND status = 1 AND end_time >= NOW()
         ORDER BY start_time ASC
         LIMIT 1`,
        [id]
      );

      const operations = await OperationLog.recentByUser(id, 20);

      const [[stats]] = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM leaves WHERE user_id = ?) AS leave_count,
            (SELECT COUNT(*) FROM leaves WHERE user_id = ? AND status = 1) AS approved_leave_count,
            (SELECT COUNT(*) FROM leaves WHERE user_id = ? AND status = 0) AS pending_leave_count,
            (SELECT COALESCE(SUM(score), 0) FROM points WHERE user_id = ?) AS total_points`,
        [id, id, id, id]
      );

      res.json({
        success: true,
        user,
        active_leave: activeLeave || null,
        leaves,
        operations,
        stats
      });
    } catch (e) {
      console.error('memberDetail failed:', e);
      res.status(500).json({ success: false, error: '获取成员详情失败' });
    }
  }

  /**
   * GET /api/admin/operations
   * 全系统近期操作，支持按 class_id 过滤
   */
  static async recentOperations(req, res) {
    try {
      const { class_id, limit } = req.query;
      const scope = await resolveScope(req.user);
      const classIds = Array.isArray(scope.classIds) ? scope.classIds : null;
      if (class_id && Array.isArray(classIds) && !classIds.includes(String(class_id))) {
        return res.status(403).json({ success: false, error: '无权查看其他区队操作记录' });
      }
      const rows = await OperationLog.recent({ classId: class_id, classIds, limit });
      res.json({ success: true, operations: rows });
    } catch (e) {
      console.error('recentOperations failed:', e);
      res.status(500).json({ success: false, error: '获取操作记录失败' });
    }
  }

  // ========== 请假类型配置（仅超管） ==========

  /**
   * GET /api/admin/leave-config
   * 返回所有请假类型配置（含禁用）
   */
  static async getLeaveConfig(req, res) {
    try {
      const configs = await LeaveConfig.getAll();
      res.json({ success: true, data: configs });
    } catch (e) {
      console.error('getLeaveConfig failed:', e);
      res.status(500).json({ success: false, error: '获取请假配置失败' });
    }
  }

  /**
   * PUT /api/admin/leave-config/:id
   * 更新单条请假类型配置（type_name, start_time, end_time, is_fixed, reasons, enabled, sort_order）
   */
  static async updateLeaveConfig(req, res) {
    try {
      const { id } = req.params;
      const config = await LeaveConfig.findById(parseInt(id, 10));
      if (!config) return res.status(404).json({ success: false, error: '配置项不存在' });

      const affected = await LeaveConfig.update(parseInt(id, 10), req.body);
      if (!affected) return res.status(400).json({ success: false, error: '无有效更新字段' });

      res.json({ success: true, message: '配置已更新' });
    } catch (e) {
      console.error('updateLeaveConfig failed:', e);
      res.status(500).json({ success: false, error: '更新请假配置失败' });
    }
  }

  // ========== 成员角色管理（仅超管） ==========

  /**
   * PUT /api/admin/members/:id/role
   * 修改成员角色，仅 SUPER_ADMIN(8) 可调用
   * Body: { role: number }
   */
  static async updateMemberRole(req, res) {
    try {
      const memberId = parseInt(req.params.id, 10);
      if (Number.isNaN(memberId)) {
        return res.status(400).json({ success: false, error: '无效的成员 ID' });
      }

      const { role } = req.body;
      if (typeof role !== 'number' || role < 0 || role > 9) {
        return res.status(400).json({ success: false, error: '无效的角色编码（0-9）' });
      }

      const user = await User.findById(memberId);
      if (!user) return res.status(404).json({ success: false, error: '成员不存在' });

      // 不允许超管修改自己的角色（防止把自己降级后无法操作）
      if (memberId === req.user.id && role !== ROLES.SUPER_ADMIN) {
        return res.status(400).json({ success: false, error: '不能修改自己的超级管理员角色' });
      }

      await User.updateRole(memberId, role);
      res.json({ success: true, message: '角色已更新' });
    } catch (e) {
      console.error('updateMemberRole failed:', e);
      res.status(500).json({ success: false, error: '修改角色失败' });
    }
  }
}

module.exports = AdminController;
