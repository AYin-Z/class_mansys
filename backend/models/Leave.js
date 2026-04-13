const db = require('../config/database');

class Leave {
  static async create(leaveData) {
    const { user_id, leave_type, start_time, end_time, reason } = leaveData;
    
    const [result] = await db.query(
      'INSERT INTO leaves (user_id, leave_type, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)',
      [user_id, leave_type, start_time, end_time, reason]
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