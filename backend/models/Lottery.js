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
    // 审计修复：原实现可对已关闭活动反复开奖
    const [[lottery]] = await db.query('SELECT id, is_active, drawn_at FROM lotteries WHERE id = ?', [lottery_id]);
    if (!lottery) throw new Error('抽奖活动不存在');
    if (Number(lottery.is_active) !== 1) throw new Error('该抽奖已结束');
    if (lottery.drawn_at) throw new Error('该抽奖已开过奖');
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
    await db.query('UPDATE lotteries SET drawn_at = NOW() WHERE id = ? AND drawn_at IS NULL', [lottery_id]);
    return ids;
  }

  static async close(id) {
    const [result] = await db.query('UPDATE lotteries SET is_active = false WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Lottery;
