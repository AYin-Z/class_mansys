const db = require('../config/database');

class Announcement {
  static async create({ title, content, creator_id }) {
    const [result] = await db.query(
      'INSERT INTO announcements (title, content, creator_id) VALUES (?, ?, ?)',
      [title, content, creator_id]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS creator_name
       FROM announcements a
       LEFT JOIN users u ON a.creator_id = u.id
       WHERE a.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS creator_name
       FROM announcements a
       LEFT JOIN users u ON a.creator_id = u.id
       ORDER BY a.created_at DESC`
    );
    return rows;
  }

  static async update(id, { title, content }) {
    const [result] = await db.query(
      'UPDATE announcements SET title = ?, content = ? WHERE id = ?',
      [title, content, id]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM announcements WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Announcement;
