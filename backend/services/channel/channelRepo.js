const db = require('../../config/database');

class ChannelRepo {
  // ---- 绑定码 ----
  static async createBindCode(code, userId, ttlMs) {
    await db.query(
      'INSERT INTO agent_bind_codes (code, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
      [code, userId, Math.round((ttlMs || 900000) / 1000)]
    );
  }

  static async consumeBindCode(code) {
    const [rows] = await db.query(
      "SELECT * FROM agent_bind_codes WHERE code = ? AND used_at IS NULL AND expires_at > NOW()",
      [code]
    );
    const row = rows[0];
    if (!row) return null;
    await db.query('UPDATE agent_bind_codes SET used_at = NOW() WHERE code = ?', [code]);
    return row;
  }

  // ---- 绑定关系 ----
  static async upsertBinding({ channel, externalId, userId, displayName }) {
    await db.query(
      "INSERT INTO agent_channel_bindings (channel, external_id, user_id, display_name, status) VALUES (?, ?, ?, ?, 'active') " +
      "ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), display_name = VALUES(display_name), status = 'active'",
      [channel, externalId, userId, displayName || null]
    );
  }

  static async findBinding(channel, externalId) {
    const [rows] = await db.query(
      "SELECT * FROM agent_channel_bindings WHERE channel = ? AND external_id = ? AND status = 'active'",
      [channel, externalId]
    );
    return rows[0] || null;
  }

  static async listBindings(userId) {
    const [rows] = await db.query(
      'SELECT id, channel, external_id, display_name, status, created_at FROM agent_channel_bindings WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  static async unbind(userId, id) {
    const [r] = await db.query(
      "UPDATE agent_channel_bindings SET status = 'revoked' WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    return r.affectedRows > 0;
  }

  static async unbindByExternal(channel, externalId) {
    const [r] = await db.query(
      "UPDATE agent_channel_bindings SET status = 'revoked' WHERE channel = ? AND external_id = ? AND status = 'active'",
      [channel, externalId]
    );
    return r.affectedRows > 0;
  }

  // ---- 长轮询游标 ----
  static async getSyncBuf(channel, accountId) {
    const [rows] = await db.query('SELECT sync_buf FROM channel_state WHERE channel = ? AND account_id = ?', [channel, accountId]);
    return (rows[0] && rows[0].sync_buf) || '';
  }

  static async setSyncBuf(channel, accountId, buf) {
    await db.query(
      'INSERT INTO channel_state (channel, account_id, sync_buf) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sync_buf = VALUES(sync_buf)',
      [channel, accountId, buf || '']
    );
  }
}

module.exports = ChannelRepo;
