const db = require('../config/database');

/**
 * 注意：suggestions 表 schema 没有 user_id（设计为匿名）。
 * 但用户在前端需要"我的提交"功能，所以这里在 status 表用户侧通过 LocalStorage 自存 id 列表。
 * 处理者信息保留：handler_id、handler_notes。
 */
class Suggestion {
  static async create({ content, category }) {
    const [result] = await db.query(
      'INSERT INTO suggestions (content, category) VALUES (?, ?)',
      [content, category || '其他']
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS handler_name
       FROM suggestions s
       LEFT JOIN users u ON s.handler_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll(filters = {}) {
    const where = [];
    const params = [];
    if (typeof filters.status === 'number') {
      where.push('s.status = ?');
      params.push(filters.status);
    }
    if (filters.category) {
      where.push('s.category = ?');
      params.push(filters.category);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT s.*, u.name AS handler_name
       FROM suggestions s
       LEFT JOIN users u ON s.handler_id = u.id
       ${sqlWhere}
       ORDER BY s.created_at DESC`,
      params
    );
    return rows;
  }

  static async getByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT s.*, u.name AS handler_name
       FROM suggestions s
       LEFT JOIN users u ON s.handler_id = u.id
       WHERE s.id IN (${placeholders})
       ORDER BY s.created_at DESC`,
      ids
    );
    return rows;
  }

  static async handle(id, { handler_id, status, handler_notes }) {
    const [result] = await db.query(
      'UPDATE suggestions SET status = ?, handler_id = ?, handler_notes = ? WHERE id = ?',
      [status, handler_id, handler_notes || '', id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Suggestion;
