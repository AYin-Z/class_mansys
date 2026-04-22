const db = require('../config/database');

class Resource {
  static async create({ name, type, url, size, uploader_id, category, description }) {
    const [result] = await db.query(
      'INSERT INTO resources (name, type, url, size, uploader_id, category, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, type, url, size || 0, uploader_id, category || '其他', description || '']
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS uploader_name
       FROM resources r
       LEFT JOIN users u ON r.uploader_id = u.id
       WHERE r.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll(category) {
    const where = category ? 'WHERE r.category = ?' : '';
    const params = category ? [category] : [];
    const [rows] = await db.query(
      `SELECT r.*, u.name AS uploader_name
       FROM resources r
       LEFT JOIN users u ON r.uploader_id = u.id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );
    return rows;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM resources WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Resource;
