const crypto = require('crypto');
const db = require('../config/database');

/**
 * 个人访问令牌（供 MCP 客户端 / 外部 agent 使用）
 *
 * 设计：
 * - 明文 `cm_` + 48 位随机 hex，**只返回一次**；库里只存 sha256，泄库也拿不到明文；
 * - prefix 只用于在列表里辨认（前 10 字符）；
 * - allow_write 决定该令牌能用哪些 MCP 工具（默认 0=只读），与用户权限矩阵叠加生效；
 * - 可随时吊销（revoked_at），每次校验刷新 last_used_at 便于发现异常。
 */
function hashToken(plain) {
  return crypto.createHash('sha256').update(String(plain)).digest('hex');
}

function generateToken() {
  return 'cm_' + crypto.randomBytes(24).toString('hex');
}

class ApiTokenService {
  static async create(userId, name, allowWrite = false) {
    const plain = generateToken();
    const prefix = plain.slice(0, 10);
    await db.query('INSERT INTO api_tokens (user_id, name, token_hash, prefix, allow_write) VALUES (?, ?, ?, ?, ?)', [
      userId, name || null, hashToken(plain), prefix, allowWrite ? 1 : 0
    ]);
    return { token: plain, prefix, allowWrite: !!allowWrite };
  }

  static async list(userId) {
    const [rows] = await db.query(
      'SELECT id, name, prefix, allow_write, last_used_at, revoked_at, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  static async revoke(userId, id) {
    const [r] = await db.query('UPDATE api_tokens SET revoked_at = NOW() WHERE id = ? AND user_id = ?', [id, userId]);
    return r.affectedRows > 0;
  }

  /** 校验令牌 → { userId, allowWrite, tokenId }（并刷新 last_used_at） */
  static async verify(plain) {
    if (!plain) return null;
    const h = hashToken(plain);
    const [rows] = await db.query('SELECT id, user_id, allow_write FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL', [h]);
    const row = rows[0];
    if (!row) return null;
    await db.query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?', [row.id]);
    return { userId: row.user_id, allowWrite: !!row.allow_write, tokenId: row.id };
  }
}

module.exports = { ApiTokenService, hashToken, generateToken };
