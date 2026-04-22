const db = require('../config/database');

class Message {
  static async create({ content, user_id, target_id, target_type, parent_id }) {
    const [result] = await db.query(
      'INSERT INTO messages (content, user_id, target_id, target_type, parent_id) VALUES (?, ?, ?, ?, ?)',
      [content, user_id, target_id, target_type, parent_id || null]
    );
    return result.insertId;
  }

  static async getByTarget(target_type, target_id) {
    const [rows] = await db.query(
      `SELECT m.*, u.name AS user_name, u.avatarUrl AS user_avatar
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.target_type = ? AND m.target_id = ?
       ORDER BY m.created_at ASC`,
      [target_type, target_id]
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM messages WHERE id = ?', [id]);
    return rows[0];
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM messages WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Message;
