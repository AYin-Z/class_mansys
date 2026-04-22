const db = require('../config/database');

class Points {
  static async addRecord({ user_id, score, reason, created_by }) {
    const [result] = await db.query(
      'INSERT INTO points (user_id, score, reason, created_by) VALUES (?, ?, ?, ?)',
      [user_id, score, reason, created_by]
    );
    return result.insertId;
  }

  static async getByUser(user_id) {
    const [rows] = await db.query(
      `SELECT p.*, c.name AS creator_name
       FROM points p
       LEFT JOIN users c ON p.created_by = c.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [user_id]
    );
    return rows;
  }

  static async getTotalByUser(user_id) {
    const [rows] = await db.query(
      'SELECT COALESCE(SUM(score), 0) AS total FROM points WHERE user_id = ?',
      [user_id]
    );
    return Number(rows[0]?.total || 0);
  }

  static async getRanking(limit = 50) {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.student_id, u.class_id, u.avatarUrl,
              COALESCE(SUM(p.score), 0) AS total_score,
              COUNT(p.id) AS records
       FROM users u
       LEFT JOIN points p ON u.id = p.user_id
       GROUP BY u.id
       ORDER BY total_score DESC, records DESC
       LIMIT ?`,
      [Number(limit)]
    );
    return rows;
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT p.*, u.name AS user_name, u.student_id, c.name AS creator_name
       FROM points p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN users c ON p.created_by = c.id
       ORDER BY p.created_at DESC`
    );
    return rows;
  }
}

module.exports = Points;
