const crypto = require('crypto');
const db = require('../config/database');

/**
 * 个人访问令牌（供 MCP 客户端 / 外部 agent 使用）
 * - 明文只返回一次；库里只存 sha256
 */
function hashToken(plain) {
  return crypto.createHash('sha256').update(String(plain)).digest('hex');
}

function generateToken() {
  return 'cm_' + crypto.randomBytes(24).toString('hex');
}

class ApiTokenService {
  static async create(userId, name) {
    const plain = generateToken();
    const prefix = plain.slice(0, 10);
    await db.query('INSERT INTO api_tokens (user_id, name, token_hash, prefix) VALUES (?, ?, ?, ?)', [
      userId, name || null, hashToken(plain), prefix
    ]);
    return { token: plain, prefix };
  }

  static async list(userId) {
    const [rows] = await db.query(
      'SELECT id, name, prefix, last_used_at, revoked_at, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  static async revoke(userId, id) {
    const [r] = await db.query('UPDATE api_tokens SET revoked_at = NOW() WHERE id = ? AND user_id = ?', [id, userId]);
    return r.affectedRows > 0;
  }

  /** 校验令牌 → 返回用户 id（并刷新 last_used_at） */
  static async verify(plain) {
    if (!plain) return null;
    const h = hashToken(plain);
    const [rows] = await db.query('SELECT id, user_id FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL', [h]);
    const row = rows[0];
    if (!row) return null;
    await db.query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?', [row.id]);
    return row.user_id;
  }
}

module.exports = { ApiTokenService, hashToken, generateToken };
