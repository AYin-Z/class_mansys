const db = require('../config/database');

class Notice {
  static async create(noticeData) {
    const { title, content, type, creator_id } = noticeData;
    
    const [result] = await db.query(
      'INSERT INTO notices (title, content, type, creator_id) VALUES (?, ?, ?, ?)',
      [title, content, type, creator_id]
    );
    
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM notices WHERE id = ?', [id]);
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query('SELECT * FROM notices ORDER BY created_at DESC');
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
      'SELECT COUNT(*) as count FROM notices n LEFT JOIN notice_reads nr ON n.id = nr.notice_id AND nr.user_id = ? WHERE nr.id IS NULL',
      [user_id]
    );
    return rows[0].count;
  }
}

module.exports = Notice;