const db = require('../../config/database');

/** 会话 state 的安全解析（旧行/异常值一律视为空草稿） */
function parseState(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch (e) {
    return null;
  }
}

function normalizeConversation(row) {
  if (!row) return null;
  return {
    ...row,
    state: parseState(row.state),
    state_version: Number(row.state_version || 0)
  };
}

/** Agent 会话/消息/待确认动作/渠道会话/附件 数据访问 */
class AgentRepo {
  // ---- 会话 ----
  static async createConversation(userId, title) {
    const [r] = await db.query('INSERT INTO agent_conversations (user_id, title) VALUES (?, ?)', [userId, title || null]);
    return r.insertId;
  }

  static async getConversation(id, userId) {
    const [rows] = await db.query('SELECT * FROM agent_conversations WHERE id = ? AND user_id = ?', [id, userId]);
    return normalizeConversation(rows[0]);
  }

  /** 内部使用：不校验归属（confirm 复验时已经拿动作行校验过 user_id） */
  static async getConversationById(id) {
    const [rows] = await db.query('SELECT * FROM agent_conversations WHERE id = ?', [id]);
    return normalizeConversation(rows[0]);
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

  static async closeConversation(id, userId) {
    if (!id) return false;
    const [r] = await db.query(
      'UPDATE agent_conversations SET closed_at = NOW(), updated_at = NOW() WHERE id = ? AND closed_at IS NULL' +
        (userId ? ' AND user_id = ?' : ''),
      userId ? [id, userId] : [id]
    );
    if (r.affectedRows > 0) {
      // 会话关闭后旧卡片一律不可确认（confirm 还会用 closed_at 做原子兜底）
      await db.query(
        "UPDATE agent_actions SET status = 'invalidated', invalidated_at = NOW() WHERE conversation_id = ? AND status = 'pending'",
        [id]
      );
    }
    return r.affectedRows > 0;
  }

  /**
   * 乐观锁保存任务状态。expectedVersion 必须与当前 state_version 一致，
   * 否则说明有并发写入（同一会话两条消息），调用方应重读后再合并。
   */
  static async saveConversationState(id, state, expectedVersion) {
    const [r] = await db.query(
      'UPDATE agent_conversations SET state = ?, state_version = state_version + 1, updated_at = NOW() WHERE id = ? AND state_version = ?',
      [state ? JSON.stringify(state) : null, id, Number(expectedVersion) || 0]
    );
    return r.affectedRows > 0;
  }

  /**
   * 读-改-写任务状态（最多重试 3 次）。mutator(state, version) 返回新 state
   * 或 null（表示不修改）。返回 { state, version, changed }。
   */
  static async mutateConversationState(id, mutator) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const conv = await AgentRepo.getConversationById(id);
      if (!conv) return { state: null, version: 0, changed: false };
      const next = mutator(conv.state, conv.state_version);
      if (next === null || next === undefined) {
        return { state: conv.state, version: conv.state_version, changed: false };
      }
      const ok = await AgentRepo.saveConversationState(id, next, conv.state_version);
      if (ok) return { state: next, version: conv.state_version + 1, changed: true };
    }
    // 冲突不是致命错误：本轮不写状态，动作仍会用旧版本生成，确认时会被版本校验拦下
    const latest = await AgentRepo.getConversationById(id);
    return { state: latest ? latest.state : null, version: latest ? latest.state_version : 0, changed: false };
  }

  // ---- 消息 ----
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

  // ---- 待确认动作 ----
  static async createAction({ conversationId, userId, tool, method, path, params, preview, risk, impact, ttlMs, stateVersion, paramsHash, configHash }) {
    const [r] = await db.query(
      'INSERT INTO agent_actions (conversation_id, user_id, tool, method, path, params, params_hash, config_hash, preview, risk, impact, state_version, expires_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
      [
        conversationId || null, userId, tool, method, path, JSON.stringify(params || {}),
        paramsHash || null, configHash || null,
        preview || null, risk || 'medium', impact || null, Number(stateVersion) || 0,
        Math.round((ttlMs || 300000) / 1000)
      ]
    );
    return r.insertId;
  }

  /** 把同一会话内旧的 pending 作废（改口/新动作/新轮次都不能再执行） */
  static async invalidatePendingActions(conversationId, userId, status = 'superseded') {
    if (!conversationId) return 0;
    const finalStatus = status === 'invalidated' ? 'invalidated' : 'superseded';
    const [r] = await db.query(
      "UPDATE agent_actions SET status = ?, invalidated_at = NOW() WHERE conversation_id = ? AND user_id = ? AND status = 'pending'",
      [finalStatus, conversationId, userId]
    );
    return r.affectedRows;
  }

  static async supersedePendingActions(conversationId, userId) {
    return AgentRepo.invalidatePendingActions(conversationId, userId, 'superseded');
  }

  /**
   * 原子抢占：只有 pending、未过期、状态版本完全一致的请求能拿到执行权。
   * affectedRows=0 表示已被别人执行/已失效/已过期。
   */
  static async claimAction({ id, userId, stateVersion, claimToken }) {
    // 原子边界：action 自身版本 + 会话当前 state_version + closed_at 必须在同一条 UPDATE 里成立。
    // 这样「改口/预校验失败/补图/重置」只要推进了会话版本或关闭会话，旧 action 就不可能被抢占。
    const [r] = await db.query(
      "UPDATE agent_actions a LEFT JOIN agent_conversations c ON c.id = a.conversation_id " +
        "SET a.status = 'executing', a.claim_token = ?, a.claimed_at = NOW() " +
        "WHERE a.id = ? AND a.user_id = ? AND a.status = 'pending' AND a.expires_at > NOW() AND a.state_version = ? " +
        'AND (a.conversation_id IS NULL OR (c.id IS NOT NULL AND c.closed_at IS NULL AND c.state_version = a.state_version))',
      [claimToken, id, userId, Number(stateVersion) || 0]
    );
    return r.affectedRows > 0;
  }

  /** 任意状态的动作（confirm 冲突分类/幂等回复用） */
  static async findAction(id) {
    const [rows] = await db.query('SELECT * FROM agent_actions WHERE id = ?', [id]);
    return normalizeAction(rows[0]);
  }

  /**
   * 某用户最近一条仍有效的待确认动作。
   *
   * 为什么需要：微信侧原来用进程内的 Map 记住 actionId，worker 一重启（Restart=always）
   * 映射就没了，用户回复「确认」会被告知"没有待确认操作"——而卡片明明还在聊天记录里。
   * 改从库里查，天然跨重启，也避免同一用户多条待确认时张冠李戴。
   */
  static async latestPendingAction(userId, conversationId) {
    const params = [userId];
    let sql = "SELECT * FROM agent_actions WHERE user_id = ? AND status = 'pending' AND expires_at > NOW()";
    if (conversationId) {
      sql += ' AND conversation_id = ?';
      params.push(conversationId);
    }
    // 会话已推进版本 / 已关闭时，旧卡片不再作为「可确认」返回
    sql += ' AND (conversation_id IS NULL OR EXISTS (SELECT 1 FROM agent_conversations c WHERE c.id = agent_actions.conversation_id AND c.state_version = agent_actions.state_version AND c.closed_at IS NULL))';
    sql += ' ORDER BY id DESC LIMIT 1';
    const [rows] = await db.query(sql, params);
    return normalizeAction(rows[0]);
  }

  static async markAction(id, status, result, opts) {
    const extra = opts || {};
    const sets = ['status = ?', 'result = ?'];
    const params = [status, result ? JSON.stringify(result).slice(0, 8000) : null];
    if (status === 'executed' || status === 'failed') sets.push('executed_at = NOW()');
    if (status === 'invalidated' || status === 'superseded') sets.push('invalidated_at = NOW()');
    if (extra.clearClaim) sets.push('claim_token = NULL');
    params.push(id);
    await db.query('UPDATE agent_actions SET ' + sets.join(', ') + ' WHERE id = ?', params);
  }

  // ---- 渠道会话 ----
  static async findChannelSession(channel, externalId) {
    const [rows] = await db.query(
      'SELECT * FROM agent_channel_sessions WHERE channel = ? AND external_id = ?',
      [channel, externalId]
    );
    return rows[0] || null;
  }

  static async createChannelSession({ channel, externalId, userId, conversationId, expiresAt }) {
    const [r] = await db.query(
      "INSERT INTO agent_channel_sessions (channel, external_id, user_id, conversation_id, status, expires_at) VALUES (?, ?, ?, ?, 'active', ?)",
      [channel, externalId, userId, conversationId, expiresAt]
    );
    return r.insertId;
  }

  static async updateChannelSession(id, { userId, conversationId, expiresAt, status }) {
    await db.query(
      'UPDATE agent_channel_sessions SET user_id = ?, conversation_id = ?, status = ?, expires_at = ?, created_at = NOW(), updated_at = NOW() WHERE id = ?',
      [userId, conversationId, status || 'active', expiresAt, id]
    );
  }

  static async touchChannelSession(id) {
    await db.query('UPDATE agent_channel_sessions SET updated_at = NOW() WHERE id = ?', [id]);
  }

  /** 解绑/换绑时关闭渠道会话指针；默认只关该 external 的 active 会话 */
  static async closeChannelSession(channel, externalId, status = 'closed') {
    const [r] = await db.query(
      "UPDATE agent_channel_sessions SET status = ?, updated_at = NOW() WHERE channel = ? AND external_id = ? AND status = 'active'",
      [status, channel, externalId]
    );
    return r.affectedRows > 0;
  }

  // ---- 入站去重 ----
  /** @returns {Promise<boolean>} true=首次见到（需要处理），false=重复消息 */
  static async markInboundSeen(channel, externalId, messageId) {
    if (!messageId) return true; // 没有可靠 id 时不去重，避免误吞消息
    const [r] = await db.query(
      'INSERT IGNORE INTO agent_inbound_dedup (channel, external_id, message_id) VALUES (?, ?, ?)',
      [channel, externalId, String(messageId).slice(0, 160)]
    );
    return r.affectedRows > 0;
  }

  // ---- 附件 ----
  static async registerAttachment({ userId, conversationId, url, name, mime, size, sha256, source }) {
    await db.query(
      'INSERT INTO agent_attachments (user_id, conversation_id, url, name, mime, size, sha256, source) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), mime = VALUES(mime), size = VALUES(size), sha256 = VALUES(sha256)',
      [userId, conversationId || null, url, name || null, mime || null, Number(size) || 0, sha256 || null, source || 'app']
    );
    return AgentRepo.findAttachmentByUrl(url);
  }

  static async findAttachmentByUrl(url) {
    const [rows] = await db.query('SELECT * FROM agent_attachments WHERE url = ?', [url]);
    return rows[0] || null;
  }

  static async listAttachmentsByConversation(conversationId, limit = 20) {
    const [rows] = await db.query(
      'SELECT * FROM agent_attachments WHERE conversation_id = ? ORDER BY id ASC LIMIT ?',
      [conversationId, Math.min(Math.max(Number(limit) || 20, 1), 100)]
    );
    return rows;
  }

  /** 把本轮附件挂到会话上（上传时还不知道 conversation_id） */
  static async bindAttachmentsToConversation(userId, urls, conversationId) {
    const list = (urls || []).filter(Boolean);
    if (!list.length || !conversationId) return;
    await db.query(
      'UPDATE agent_attachments SET conversation_id = ? WHERE user_id = ? AND url IN (?)',
      [conversationId, userId, list]
    );
  }
}

function normalizeAction(row) {
  if (!row) return null;
  return {
    ...row,
    params: typeof row.params === 'string' ? safeParse(row.params) : row.params,
    state_version: Number(row.state_version || 0)
  };
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

module.exports = AgentRepo;
