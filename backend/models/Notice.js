const db = require('../config/database');

class Notice {
  static async create(noticeData) {
    const {
      title,
      content,
      type = '日常',
      creator_id,
      priority = 0,
      is_pinned = false,
      is_todo = false,
      attachments
    } = noticeData;

    const attachJson = attachments ? JSON.stringify(attachments) : null;
    const [result] = await db.query(
      'INSERT INTO notices (title, content, type, priority, is_pinned, is_todo, attachments, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, content, type, priority, is_pinned, is_todo, attachJson, creator_id]
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
    if (rows[0] && typeof rows[0].attachments === 'string') {
      try { rows[0].attachments = JSON.parse(rows[0].attachments); } catch { rows[0].attachments = null; }
    }
    return rows[0];
  }

  /** 列表 SELECT（含"我是否已读/已完成"两个 LEFT JOIN）；getAll 与 getPage 共用，保证口径一致 */
  static _listSql(userId = null) {
    let query = `SELECT n.*, u.name AS creator_name, u.nickName AS creator_nickname`;
    if (userId) {
      query += `, (nr.id IS NOT NULL) AS is_read, (nc.id IS NOT NULL) AS is_completed`;
    }
    query += `\n       FROM notices n\n       LEFT JOIN users u ON n.creator_id = u.id`;
    if (userId) {
      query += `\n       LEFT JOIN notice_reads nr ON n.id = nr.notice_id AND nr.user_id = ${Number(userId)}`;
      query += `\n       LEFT JOIN notice_completions nc ON n.id = nc.notice_id AND nc.user_id = ${Number(userId)}`;
    }
    return query;
  }

  static _parseAttachments(rows) {
    rows.forEach(r => {
      if (r.attachments && typeof r.attachments === 'string') {
        try { r.attachments = JSON.parse(r.attachments); } catch { r.attachments = null; }
      }
    });
    return rows;
  }

  static async getAll(userId = null) {
    const query = this._listSql(userId) + `\n       ORDER BY n.is_pinned DESC, n.created_at DESC`;
    const [rows] = await db.query(query);
    return this._parseAttachments(rows);
  }

  /**
   * 分页列表（P1-3，offset 模式）
   *
   * 关键点：区队可见性过滤必须**下推到 SQL**，否则"先全量取再 filterByClassScope"
   * 会让每页条数不足、total 也不对（controller 里仍会再跑一次 filterByClassScope 兜底）。
   *
   * @param {number|null} userId 传了就附带 is_read / is_completed
   * @param {object} opts
   * @param {{sql:string, params:any[]}|null} [opts.scopeFilter=null] classScopeSql 生成的可见性片段
   * @param {number} opts.limit
   * @param {number} opts.offset
   * @returns {Promise<{rows:Array, total:number}>}
   */
  static async getPage(userId = null, { scopeFilter = null, limit, offset } = {}) {
    const whereSql = scopeFilter && scopeFilter.sql ? ` WHERE ${scopeFilter.sql}` : '';
    const whereParams = (scopeFilter && scopeFilter.params) ? scopeFilter.params : [];

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM notices n${whereSql}`,
      whereParams
    );
    // 排序加 id 兜底：created_at 同秒的多条通知在分页时必须有稳定次序，否则会重复/漏项
    const [rows] = await db.query(
      `${this._listSql(userId)}${whereSql}\n       ORDER BY n.is_pinned DESC, n.created_at DESC, n.id DESC\n       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    return { rows: this._parseAttachments(rows), total: Number((countRows[0] && countRows[0].total) || 0) };
  }

  static async markAsRead(notice_id, user_id) {
    const [result] = await db.query(
      'INSERT IGNORE INTO notice_reads (notice_id, user_id) VALUES (?, ?)',
      [notice_id, user_id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 未读数：与列表同口径（本区队 + 全局，且排除自己发布的）
   * 审计修复：原实现不带区队条件，红点数恒大于列表条数。
   */
  static async getUnreadCount(user_id, classId) {
    const scopeSql = classId ? ' AND (n.class_id IS NULL OR n.class_id = ?)' : '';
    const params = classId ? [user_id, user_id, classId] : [user_id, user_id];
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM notices n
       LEFT JOIN notice_reads nr ON n.id = nr.notice_id AND nr.user_id = ?
       WHERE nr.id IS NULL AND n.creator_id <> ?${scopeSql}`,
      params
    );
    return rows[0].count;
  }

  static async update(id, fields) {
    const allowedFields = ['title', 'content', 'summary', 'type', 'priority', 'is_pinned', 'is_todo', 'attachments'];
    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(field === 'attachments' ? JSON.stringify(fields[field]) : fields[field]);
      }
    }

    if (setClauses.length === 0) return 0;

    values.push(id);
    const [result] = await db.query(
      `UPDATE notices SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows;
  }

  static async delete(id) {
    await db.query('DELETE FROM notice_reads WHERE notice_id = ?', [id]);
    await db.query('DELETE FROM notice_completions WHERE notice_id = ?', [id]);
    const [result] = await db.query('DELETE FROM notices WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // ---- 待办完成 ----

  static async isCompletedBy(notice_id, user_id) {
    const [rows] = await db.query(
      'SELECT id FROM notice_completions WHERE notice_id = ? AND user_id = ?',
      [notice_id, user_id]
    );
    return rows.length > 0;
  }

  static async markComplete(notice_id, user_id) {
    const [result] = await db.query(
      'INSERT IGNORE INTO notice_completions (notice_id, user_id) VALUES (?, ?)',
      [notice_id, user_id]
    );
    return result.affectedRows > 0;
  }

  static async getTodoCount(user_id, classId) {
    const scopeSql = classId ? ' AND (n.class_id IS NULL OR n.class_id = ?)' : '';
    const params = classId ? [user_id, classId] : [user_id];
    const [rows] = await db.query(
      'SELECT COUNT(*) as cnt FROM notices n LEFT JOIN notice_completions nc ON n.id = nc.notice_id AND nc.user_id = ? WHERE n.is_todo = true AND nc.id IS NULL' + scopeSql,
      params
    );
    return rows[0].cnt;
  }

  /** 获取指定待办通知的完成状态 */
  static async getTodoCompletionStatus(notice_id) {
    // 审计修复：名单原来取"全库学员"，任何区队干部都能拿到全中队姓名+学号，分母也全错。
    // 现在按通知自身的区队过滤（class_id 为 NULL 表示面向全中队）
    const [[notice]] = await db.query('SELECT class_id FROM notices WHERE id = ?', [notice_id]);
    const classId = notice && notice.class_id ? String(notice.class_id) : null;
    const scopeSql = classId ? ' AND u.class_id = ?' : '';
    const classParams = classId ? [classId] : [];

    const [completed] = await db.query(
      `SELECT u.id, u.name, u.student_id, nc.completed_at
       FROM notice_completions nc
       JOIN users u ON nc.user_id = u.id
       WHERE nc.notice_id = ?${scopeSql}
       ORDER BY nc.completed_at`,
      [notice_id].concat(classParams)
    );
    const [allUsers] = await db.query(
      "SELECT u.id, u.name, u.student_id FROM users u WHERE u.member_type = 'student'" + scopeSql + ' ORDER BY u.student_id',
      classParams
    );
    const completedIds = new Set(completed.map(c => c.id));
    const pending = allUsers.filter(u => !completedIds.has(u.id));
    return { completed, pending, total: allUsers.length, class_id: classId };
  }
}

module.exports = Notice;
