const db = require('../config/database');

class Vote {
  /**
   * @param {object} data
   * @param {string} data.title
   * @param {string} data.description
   * @param {'single'|'multiple'} data.type
   * @param {number} data.creator_id
   * @param {string} data.start_time  ISO/MySQL DATETIME
   * @param {string} data.end_time
   * @param {string[]} data.options  选项内容数组
   */
  static async create(data) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [voteResult] = await conn.query(
        `INSERT INTO votes (title, description, type, creator_id, start_time, end_time, is_active, visible_scope, vote_scope)
         VALUES (?, ?, ?, ?, ?, ?, true, ?, ?)`,
        [data.title, data.description || '', data.type || 'single', data.creator_id, data.start_time, data.end_time,
         data.visible_scope || 'all', data.vote_scope || 'all']
      );
      const voteId = voteResult.insertId;

      for (const content of data.options) {
        if (!content || !content.trim()) continue;
        await conn.query(
          'INSERT INTO vote_options (vote_id, content) VALUES (?, ?)',
          [voteId, content.trim()]
        );
      }
      await conn.commit();
      return voteId;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  static async findById(id) {
    const [votes] = await db.query(
      `SELECT v.*, u.name AS creator_name
       FROM votes v
       LEFT JOIN users u ON v.creator_id = u.id
       WHERE v.id = ?`,
      [id]
    );
    return votes[0];
  }

  static async getOptions(vote_id) {
    const [options] = await db.query(
      `SELECT o.id, o.vote_id, o.content,
              (SELECT COUNT(*) FROM vote_records r WHERE r.option_id = o.id) AS vote_count
       FROM vote_options o
       WHERE o.vote_id = ?
       ORDER BY o.id`,
      [vote_id]
    );
    return options;
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT v.*, u.name AS creator_name,
              (SELECT COUNT(DISTINCT r.user_id) FROM vote_records r WHERE r.vote_id = v.id) AS participant_count
       FROM votes v
       LEFT JOIN users u ON v.creator_id = u.id
       ORDER BY v.created_at DESC`
    );
    return rows;
  }

  static async getUserChoices(vote_id, user_id) {
    const [rows] = await db.query(
      'SELECT option_id FROM vote_records WHERE vote_id = ? AND user_id = ?',
      [vote_id, user_id]
    );
    return rows.map(r => r.option_id);
  }

  static async cast({ vote_id, user_id, option_ids, type }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 单选：先清空旧记录，再写入新记录
      if (type === 'single') {
        await conn.query('DELETE FROM vote_records WHERE vote_id = ? AND user_id = ?', [vote_id, user_id]);
      }
      for (const optId of option_ids) {
        // INSERT IGNORE 避免多选场景下重复投同一个选项报错
        await conn.query(
          'INSERT IGNORE INTO vote_records (vote_id, user_id, option_id) VALUES (?, ?, ?)',
          [vote_id, user_id, optId]
        );
      }
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  static async close(id) {
    const [result] = await db.query('UPDATE votes SET is_active = false WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Vote;
