const db = require('../config/database');

class Notice {
  static async create(noticeData) {
    const {
      title,
      content,
      type = '日常',
      creator_id,
      priority = 0,
      is_pinned = false
    } = noticeData;

    const [result] = await db.query(
      'INSERT INTO notices (title, content, type, priority, is_pinned, creator_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, content, type, priority, is_pinned, creator_id]
    );

    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT n.*, u.name AS creator_name, u.nickName AS creator_nickname
       FROM notices n
       LEFT JOIN users u ON n.creator_id = u.id
       WHERE n.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT n.*, u.name AS creator_name, u.nickName AS creator_nickname
       FROM notices n
       LEFT JOIN users u ON n.creator_id = u.id
       ORDER BY n.is_pinned DESC, n.created_at DESC`
    );
    return rows;
  }

  static async markAsRead(notice_id, user_id) {
    const [result] = await db.query(
      'INSERT IGNORE INTO notice_reads (notice_id, user_id) VALUES (?, ?)',
      [notice_id, user_id]
    );
    return result.affectedRows > 0;
  }

  static async getUnreadCount(user_id) {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM notices n
       LEFT JOIN notice_reads nr ON n.id = nr.notice_id AND nr.user_id = ?
       WHERE nr.id IS NULL`,
      [user_id]
    );
    return rows[0].count;
  }

  static async delete(id) {
    await db.query('DELETE FROM notice_reads WHERE notice_id = ?', [id]);
    const [result] = await db.query('DELETE FROM notices WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Notice;
