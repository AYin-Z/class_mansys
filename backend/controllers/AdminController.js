const db = require('../config/database');
const User = require('../models/User');
const OperationLog = require('../models/OperationLog');

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
      const rows = await OperationLog.recent({ classId: class_id, limit });
      res.json({ success: true, operations: rows });
    } catch (e) {
      console.error('recentOperations failed:', e);
      res.status(500).json({ success: false, error: '获取操作记录失败' });
    }
  }
}

module.exports = AdminController;
