const db = require('../config/database');

/**
 * 操作记录表访问层
 * 存储所有敏感/写操作，供管理员查看成员近期系统内操作
 */
class OperationLog {
  /**
   * 写入一条操作记录
   * 任何一个字段写失败都不能阻塞业务主流程，因此内部静默吃掉错误。
   */
  static async create({
    user_id = null,
    action,
    resource_type = null,
    resource_id = null,
    method = null,
    path = null,
    status_code = null,
    ip = null,
    detail = null
  }) {
    try {
      if (!action) return;
      const payload = detail == null
        ? null
        : (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 2000));
      await db.query(
        `INSERT INTO operation_logs
         (user_id, action, resource_type, resource_id, method, path, status_code, ip, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id, action, resource_type, resource_id, method, path, status_code, ip, payload]
      );
    } catch (e) {
      console.warn('[operation_log] 写入失败（已忽略）:', e.message);
    }
  }

  /**
   * 按用户拉取最近操作，默认 20 条
   */
  static async recentByUser(userId, limit = 20) {
    const cap = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const [rows] = await db.query(
      `SELECT id, action, resource_type, resource_id, method, path, status_code, detail, created_at
       FROM operation_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, cap]
    );
    return rows;
  }

  /**
   * 全系统最近操作（可选按班级过滤，需要 join users）
   */
  static async recent({ classId, limit = 100 } = {}) {
    const cap = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    if (classId) {
      const [rows] = await db.query(
        `SELECT l.*, u.name AS user_name, u.student_id, u.class_id
         FROM operation_logs l
         LEFT JOIN users u ON u.id = l.user_id
         WHERE u.class_id = ?
         ORDER BY l.created_at DESC
         LIMIT ?`,
        [classId, cap]
      );
      return rows;
    }
    const [rows] = await db.query(
      `SELECT l.*, u.name AS user_name, u.student_id, u.class_id
       FROM operation_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT ?`,
      [cap]
    );
    return rows;
  }
}

module.exports = OperationLog;
