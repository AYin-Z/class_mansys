const db = require('../config/database');

class Lottery {
  static async create({ name, description, rules, creator_id, start_time, end_time }) {
    const [result] = await db.query(
      `INSERT INTO lotteries (name, description, rules, creator_id, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || '', rules, creator_id, start_time, end_time]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT l.*, u.name AS creator_name
       FROM lotteries l
       LEFT JOIN users u ON l.creator_id = u.id
       WHERE l.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT l.*, u.name AS creator_name,
              (SELECT COUNT(*) FROM lottery_participants p WHERE p.lottery_id = l.id) AS participant_count,
              (SELECT COUNT(*) FROM lottery_participants p WHERE p.lottery_id = l.id AND p.is_winner = true) AS winner_count
       FROM lotteries l
       LEFT JOIN users u ON l.creator_id = u.id
       ORDER BY l.created_at DESC`
    );
    return rows;
  }

  static async join({ lottery_id, user_id }) {
    try {
      const [result] = await db.query(
        'INSERT INTO lottery_participants (lottery_id, user_id) VALUES (?, ?)',
        [lottery_id, user_id]
      );
      return result.insertId;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return null;
      throw e;
    }
  }

  static async getParticipants(lottery_id) {
    const [rows] = await db.query(
      `SELECT p.*, u.name AS user_name, u.student_id, u.avatarUrl
       FROM lottery_participants p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.lottery_id = ?
       ORDER BY p.created_at DESC`,
      [lottery_id]
    );
    return rows;
  }

  static async hasJoined(lottery_id, user_id) {
    const [rows] = await db.query(
      'SELECT id, is_winner, prize FROM lottery_participants WHERE lottery_id = ? AND user_id = ?',
      [lottery_id, user_id]
    );
    return rows[0];
  }

  static async draw(lottery_id, { winner_count, prize }) {
    const [pool] = await db.query(
      'SELECT id FROM lottery_participants WHERE lottery_id = ? AND is_winner = false',
      [lottery_id]
    );
    if (pool.length === 0) return [];
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(Number(winner_count) || 1, shuffled.length));
    const ids = picked.map(p => p.id);
    if (ids.length === 0) return [];
    await db.query(
      `UPDATE lottery_participants SET is_winner = true, prize = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
      [prize || '神秘奖品', ...ids]
    );
    return ids;
  }

  static async close(id) {
    const [result] = await db.query('UPDATE lotteries SET is_active = false WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Lottery;
