const db = require('../config/database');

class Psychological {
  static async create({ user_id, content }) {
    const [result] = await db.query(
      'INSERT INTO psychological_applications (user_id, content) VALUES (?, ?)',
      [user_id, content]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS user_name, u.student_id, h.name AS handler_name
       FROM psychological_applications a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN users h ON a.handler_id = h.id
       WHERE a.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getByUser(user_id) {
    const [rows] = await db.query(
      `SELECT * FROM psychological_applications WHERE user_id = ? ORDER BY created_at DESC`,
      [user_id]
    );
    return rows;
  }

  static async getAll(filters = {}) {
    const where = [];
    const params = [];
    if (filters.status !== undefined) { where.push('a.status = ?'); params.push(filters.status); }
    const sql = `SELECT a.*, u.name AS user_name, u.student_id, h.name AS handler_name
                 FROM psychological_applications a
                 LEFT JOIN users u ON a.user_id = u.id
                 LEFT JOIN users h ON a.handler_id = h.id
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY a.created_at DESC`;
    const [rows] = await db.query(sql, params);
    return rows;
  }

  static async handle(id, { handler_id, status, handler_notes }) {
    const [result] = await db.query(
      `UPDATE psychological_applications SET handler_id = ?, status = ?, handler_notes = ? WHERE id = ?`,
      [handler_id, status, handler_notes || '', id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Psychological;
