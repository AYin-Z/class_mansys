const db = require('../config/database');

class Leave {
  static async create(leaveData) {
    const { user_id, leave_type, type, start_time, end_time, reason } = leaveData;
    const finalType = leave_type || type;
    // 兼容 ISO 8601 格式（前端可能发 "2026-05-15T08:00:00.000Z"）
    const fmtStart = start_time ? start_time.replace('T', ' ').replace(/\.\d+Z$/, '') : null;
    const fmtEnd = end_time ? end_time.replace('T', ' ').replace(/\.\d+Z$/, '') : null;
    
    const [result] = await db.query(
      'INSERT INTO leaves (user_id, leave_type, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)',
      [user_id, finalType, fmtStart, fmtEnd, reason]
    );
    
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM leaves WHERE id = ?', [id]);
    return rows[0];
  }

  static async findByUserId(user_id) {
    const [rows] = await db.query('SELECT * FROM leaves WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
    return rows;
  }

  static async getAll() {
    const [rows] = await db.query('SELECT * FROM leaves ORDER BY created_at DESC');
    return rows;
  }

  /** 管理员列表：附带申请人姓名、学号 */
  static async getAllWithApplicants() {
    const [rows] = await db.query(
      `SELECT l.*, 
              u.name AS applicant_name, u.student_id AS applicant_student_id,
              ap.name AS approver_name
       FROM leaves l
       LEFT JOIN users u ON l.user_id = u.id
       LEFT JOIN users ap ON l.approver_id = ap.id
       ORDER BY l.created_at DESC`
    );
    return rows;
  }

  /** 单条详情：附带申请人信息和审批人信息 */
  static async findByIdWithApplicant(id) {
    const [rows] = await db.query(
      `SELECT l.*, 
              u.name AS applicant_name, u.student_id AS applicant_student_id,
              ap.name AS approver_name
       FROM leaves l
       LEFT JOIN users u ON l.user_id = u.id
       LEFT JOIN users ap ON l.approver_id = ap.id
       WHERE l.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async updateStatus(id, status, approver_id, approval_notes) {
    const [result] = await db.query(
      'UPDATE leaves SET status = ?, approver_id = ?, approval_time = NOW(), approval_notes = ? WHERE id = ?',
      [status, approver_id, approval_notes, id]
    );
    
    return result.affectedRows > 0;
  }

  static async cancel(id, cancelled_time) {
    const [result] = await db.query(
      'UPDATE leaves SET is_cancelled = true, cancelled_time = ? WHERE id = ?',
      [cancelled_time, id]
    );
    
    return result.affectedRows > 0;
  }
}

module.exports = Leave;