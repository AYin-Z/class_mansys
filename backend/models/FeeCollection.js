const db = require('../config/database');

/**
 * 班费收缴
 *
 * 审计修复要点：
 * - 「在编人数」统一为 member_type='student' 且限定本区队（原实现用 COUNT(*) FROM users 全库，含已离开/辅导员/系统账号）；
 * - 缴纳金额服务端取值/校验（原实现直接吃 req.body.amount，可为 0.01 或负数，直接改写班费余额）；
 * - 只有未截止（status=0）的批次可缴纳/免缴；
 * - 已缴纳的不再静默覆盖金额，重复缴纳直接拒绝并提示；
 * - 免缴不计入「已缴人数」与「已收金额」（原实现写 paid_at=NOW() 导致收缴率虚高）；
 * - 所有写入走事务，collected_amount 由服务端聚合重算。
 */
class FeeCollection {
  /** 本区队在编学员数（分母统一口径） */
  static async rosterCount(classId) {
    if (!classId) return 0;
    const [[row]] = await db.query(
      "SELECT COUNT(*) AS c FROM users WHERE class_id = ? AND member_type = 'student'",
      [classId]
    );
    return Number(row.c || 0);
  }

  static async create(data) {
    const { title, amount_per_person, semester, created_by, class_id } = data;
    const amount = Number(amount_per_person);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('人均金额必须大于 0');
    if (!class_id) throw new Error('缺少区队信息，无法发起收缴');
    const count = await FeeCollection.rosterCount(class_id);
    if (!count) throw new Error('本区队暂无在编学员，无法发起收缴');
    const [result] = await db.query(
      'INSERT INTO fee_collections (title, amount_per_person, total_expected, semester, created_by, class_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, amount, Math.round(amount * count * 100) / 100, semester, created_by, class_id]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT fc.*, u.name as creator_name,
        (SELECT COUNT(*) FROM fee_collection_records r WHERE r.collection_id = fc.id AND r.paid_at IS NOT NULL AND r.is_exempt = 0) as paid_count,
        (SELECT COUNT(*) FROM fee_collection_records r WHERE r.collection_id = fc.id AND r.is_exempt = 1) as exempt_count,
        (SELECT COUNT(*) FROM users uu WHERE uu.class_id = fc.class_id AND uu.member_type = 'student') as total_count
      FROM fee_collections fc
      LEFT JOIN users u ON fc.created_by = u.id
      WHERE fc.id = ?`,
      [id]
    );
    return rows[0];
  }

  /** 某批次是否已缴纳（用于前端隐藏按钮） */
  static async myRecord(collectionId, userId) {
    const [[row]] = await db.query(
      'SELECT amount, is_exempt, paid_at FROM fee_collection_records WHERE collection_id = ? AND user_id = ?',
      [collectionId, userId]
    );
    return row || null;
  }

  static async getAll(classIds, userId) {
    const where = [];
    const params = [];
    if (Array.isArray(classIds)) {
      if (!classIds.length) return [];
      where.push('fc.class_id IN (' + classIds.map(() => '?').join(',') + ')');
      params.push(...classIds);
    }
    const myParams = userId ? [userId] : [];
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [rows] = await db.query(
      `SELECT fc.*, u.name as creator_name,
        (SELECT COUNT(*) FROM fee_collection_records r WHERE r.collection_id = fc.id AND r.paid_at IS NOT NULL AND r.is_exempt = 0) as paid_count,
        (SELECT COUNT(*) FROM fee_collection_records r WHERE r.collection_id = fc.id AND r.is_exempt = 1) as exempt_count,
        (SELECT COUNT(*) FROM users uu WHERE uu.class_id = fc.class_id AND uu.member_type = 'student') as total_count,
        (SELECT r.amount FROM fee_collection_records r WHERE r.collection_id = fc.id AND r.user_id = ? AND r.paid_at IS NOT NULL AND r.is_exempt = 0 LIMIT 1) as my_paid_amount,
        (SELECT r.is_exempt FROM fee_collection_records r WHERE r.collection_id = fc.id AND r.user_id = ? AND r.is_exempt = 1 LIMIT 1) as my_exempt
      FROM fee_collections fc
      LEFT JOIN users u ON fc.created_by = u.id
      ${whereSql}
      ORDER BY fc.created_at DESC`,
      myParams.concat(myParams, params)
    );
    return rows;
  }

  static async getRecords(collectionId) {
    const [rows] = await db.query(
      `SELECT fcr.*, u.name, u.student_id
      FROM fee_collection_records fcr
      LEFT JOIN users u ON fcr.user_id = u.id
      WHERE fcr.collection_id = ?
      ORDER BY u.student_id`,
      [collectionId]
    );
    return rows;
  }

  /** 重算批次已收金额（服务端聚合，不信任前端） */
  static async recalcCollected(conn, collectionId) {
    await conn.query(
      `UPDATE fee_collections SET collected_amount = (
        SELECT COALESCE(SUM(amount), 0) FROM fee_collection_records WHERE collection_id = ? AND is_exempt = 0
      ) WHERE id = ?`,
      [collectionId, collectionId]
    );
  }

  /**
   * 缴纳：金额以服务端「人均应缴」为准，只允许未截止批次，已缴不再覆盖
   * @returns {{ok:boolean, message:string, amount?:number}}
   */
  static async pay(collectionId, userId, amountInput) {
    const collection = await FeeCollection.findById(collectionId);
    if (!collection) return { ok: false, message: '收缴批次不存在' };
    if (Number(collection.status) !== 0) return { ok: false, message: '该批次已截止，无法缴纳' };

    const expected = Number(collection.amount_per_person);
    const paid = await FeeCollection.myRecord(collectionId, userId);
    if (paid && paid.paid_at) return { ok: false, message: '你已缴纳过该批次（如需更正请联系生活副区）' };

    // 允许不传金额（取应收），传了则必须与应收一致
    let amount = expected;
    if (amountInput !== undefined && amountInput !== null && amountInput !== '') {
      const given = Number(amountInput);
      if (!Number.isFinite(given) || given <= 0) return { ok: false, message: '缴纳金额必须大于 0' };
      if (Math.abs(given - expected) > 0.001) {
        return { ok: false, message: '缴纳金额应为 ' + expected.toFixed(2) + ' 元（如需调整请联系生活副区）' };
      }
      amount = given;
    }
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: '人均金额配置异常，请联系生活副区' };

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO fee_collection_records (collection_id, user_id, amount, is_exempt, paid_at)
         VALUES (?, ?, ?, 0, NOW())
         ON DUPLICATE KEY UPDATE amount = VALUES(amount), is_exempt = 0, paid_at = NOW()`,
        [collectionId, userId, amount]
      );
      await FeeCollection.recalcCollected(conn, collectionId);
      await conn.commit();
      return { ok: true, message: '缴纳成功', amount };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /** 免缴：不计入已缴人数/已收金额，且只允许未截止批次 */
  static async markExempt(collectionId, userId, remark, classIds) {
    const collection = await FeeCollection.findById(collectionId);
    if (!collection) return { ok: false, message: '收缴批次不存在' };
    if (Number(collection.status) !== 0) return { ok: false, message: '该批次已截止，无法调整免缴' };
    if (Array.isArray(classIds) && classIds.indexOf(String(collection.class_id)) === -1) {
      return { ok: false, message: '无权操作其他区队的收缴批次' };
    }
    const [[target]] = await db.query('SELECT id, class_id FROM users WHERE id = ?', [userId]);
    if (!target) return { ok: false, message: '成员不存在' };
    if (String(target.class_id) !== String(collection.class_id)) {
      return { ok: false, message: '只能对本区队成员设置免缴' };
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO fee_collection_records (collection_id, user_id, amount, is_exempt, paid_at, remark)
         VALUES (?, ?, 0, 1, NULL, ?)
         ON DUPLICATE KEY UPDATE amount = 0, is_exempt = 1, paid_at = NULL, remark = VALUES(remark)`,
        [collectionId, userId, remark]
      );
      await FeeCollection.recalcCollected(conn, collectionId);
      await conn.commit();
      return { ok: true, message: '已标记免缴' };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  static async close(collectionId, classIds) {
    const collection = await FeeCollection.findById(collectionId);
    if (!collection) return { ok: false, message: '收缴批次不存在' };
    if (Array.isArray(classIds) && classIds.indexOf(String(collection.class_id)) === -1) {
      return { ok: false, message: '无权操作其他区队的收缴批次' };
    }
    if (Number(collection.status) !== 0) return { ok: false, message: '该批次已截止' };
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await FeeCollection.recalcCollected(conn, collectionId);
      await conn.query('UPDATE fee_collections SET status = 1 WHERE id = ? AND status = 0', [collectionId]);
      await conn.commit();
      return { ok: true, message: '已截止收缴' };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

module.exports = FeeCollection;
