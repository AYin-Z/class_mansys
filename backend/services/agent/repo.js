const db = require('../../config/database');

/** Agent 会话/消息/待确认动作 数据访问 */
class AgentRepo {
  static async createConversation(userId, title) {
    const [r] = await db.query('INSERT INTO agent_conversations (user_id, title) VALUES (?, ?)', [userId, title || null]);
    return r.insertId;
  }

  static async getConversation(id, userId) {
    const [rows] = await db.query('SELECT * FROM agent_conversations WHERE id = ? AND user_id = ?', [id, userId]);
    return rows[0] || null;
  }

  static async listConversations(userId, limit = 20) {
    const [rows] = await db.query(
      'SELECT id, title, created_at, updated_at FROM agent_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
      [userId, Math.min(Math.max(Number(limit) || 20, 1), 100)]
    );
    return rows;
  }

  static async touchConversation(id) {
    await db.query('UPDATE agent_conversations SET updated_at = NOW() WHERE id = ?', [id]);
  }

  static async addMessage(conversationId, role, content, toolCalls) {
    const payload = toolCalls ? JSON.stringify(toolCalls) : null;
    const [r] = await db.query(
      'INSERT INTO agent_messages (conversation_id, role, content, tool_calls) VALUES (?, ?, ?, ?)',
      [conversationId, role, content || '', payload]
    );
    return r.insertId;
  }

  static async listMessages(conversationId, limit = 50) {
    const [rows] = await db.query(
      'SELECT id, role, content, tool_calls, created_at FROM agent_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT ?',
      [conversationId, Math.min(Math.max(Number(limit) || 50, 1), 200)]
    );
    return rows.map((r) => ({
      ...r,
      tool_calls: typeof r.tool_calls === 'string' ? safeParse(r.tool_calls) : r.tool_calls
    }));
  }

  static async countUserMessagesLast24h(userId) {
    const [rows] = await db.query(
      "SELECT COUNT(*) AS c FROM agent_messages m JOIN agent_conversations c ON m.conversation_id = c.id WHERE c.user_id = ? AND m.role = 'user' AND m.created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)",
      [userId]
    );
    return Number(rows[0]?.c || 0);
  }

  static async createAction({ conversationId, userId, tool, method, path, params, preview, ttlMs }) {
    const [r] = await db.query(
      'INSERT INTO agent_actions (conversation_id, user_id, tool, method, path, params, preview, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
      [conversationId || null, userId, tool, method, path, JSON.stringify(params || {}), preview || null, Math.round((ttlMs || 300000) / 1000)]
    );
    return r.insertId;
  }

  static async getAction(id) {
    const [rows] = await db.query(
      "SELECT * FROM agent_actions WHERE id = ? AND status = 'pending' AND expires_at > NOW()",
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    return { ...row, params: typeof row.params === 'string' ? safeParse(row.params) : row.params };
  }

  static async markAction(id, status, result) {
    await db.query('UPDATE agent_actions SET status = ?, result = ?, executed_at = NOW() WHERE id = ?', [
      status,
      result ? JSON.stringify(result).slice(0, 8000) : null,
      id
    ]);
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

module.exports = AgentRepo;
