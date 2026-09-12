const db = require('../config/database');

/**
 * 公告模型（含修订历史）
 *
 * 2026-09（P3-4）：公告支持编辑，但每次改动都要留痕并能回退：
 *  - announcements 表始终是"当前版本"
 *  - announcement_revisions 存不可变快照（发布/编辑/回退各写一条）
 *  - 回退 = 读取旧版本内容 → 写回 announcements → 再新增一条 source='revert' 的快照
 *    （历史不删，这样"回退"本身也可追溯、可再回退）
 */
class Announcement {
  /** 当前最新版本号（没有修订记录时为 0） */
  static async currentVersion(id, conn = db) {
    const [rows] = await conn.query(
      'SELECT COALESCE(MAX(version), 0) AS v FROM announcement_revisions WHERE announcement_id = ?',
      [id]
    );
    return Number(rows[0]?.v || 0);
  }

  /** 写入一条修订快照 */
  static async addRevision(id, { title, content, is_pinned, editor_id, source = 'edit' }, conn = db) {
    const version = (await this.currentVersion(id, conn)) + 1;
    await conn.query(
      `INSERT INTO announcement_revisions (announcement_id, version, title, content, is_pinned, editor_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, version, title, content, is_pinned ? 1 : 0, editor_id || null, source]
    );
    return version;
  }

  /** 发布（首次）：写公告 + v1 快照，同一事务 */
  static async create({ title, content, creator_id, is_pinned }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'INSERT INTO announcements (title, content, creator_id, is_pinned) VALUES (?, ?, ?, ?)',
        [title, content, creator_id, is_pinned ? 1 : 0]
      );
      const id = result.insertId;
      await this.addRevision(id, { title, content, is_pinned, editor_id: creator_id, source: 'publish' }, conn);
      await conn.commit();
      return id;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS creator_name
       FROM announcements a
       LEFT JOIN users u ON a.creator_id = u.id
       WHERE a.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS creator_name,
              (SELECT COUNT(*) FROM announcement_revisions r WHERE r.announcement_id = a.id) AS revision_count
       FROM announcements a
       LEFT JOIN users u ON a.creator_id = u.id
       ORDER BY a.created_at DESC`
    );
    return rows;
  }

  /**
   * 编辑：更新当前值 + 追加一条快照
   * @param {object} patch 未提供的字段沿用当前值
   */
  static async update(id, patch, editorId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM announcements WHERE id = ? FOR UPDATE', [id]);
      const current = rows[0];
      if (!current) {
        await conn.rollback();
        return null;
      }
      const next = {
        title: patch.title !== undefined ? patch.title : current.title,
        content: patch.content !== undefined ? patch.content : current.content,
        is_pinned: patch.is_pinned !== undefined ? !!patch.is_pinned : !!current.is_pinned,
      };
      await conn.query('UPDATE announcements SET title = ?, content = ?, is_pinned = ? WHERE id = ?', [
        next.title, next.content, next.is_pinned ? 1 : 0, id,
      ]);
      const version = await this.addRevision(id, { ...next, editor_id: editorId, source: 'edit' }, conn);
      await conn.commit();
      return { id, version, ...next };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /** 修订列表（不含正文，正文按需单独取，避免一次传所有历史 HTML） */
  static async listRevisions(id) {
    const [rows] = await db.query(
      `SELECT r.id, r.announcement_id, r.version, r.title, r.is_pinned, r.source, r.created_at,
              r.editor_id, u.name AS editor_name,
              CHAR_LENGTH(r.content) AS content_length
       FROM announcement_revisions r
       LEFT JOIN users u ON r.editor_id = u.id
       WHERE r.announcement_id = ?
       ORDER BY r.version DESC`,
      [id]
    );
    return rows;
  }

  /** 单个修订的完整内容（查看/回退用） */
  static async getRevision(id, version) {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS editor_name
       FROM announcement_revisions r
       LEFT JOIN users u ON r.editor_id = u.id
       WHERE r.announcement_id = ? AND r.version = ?`,
      [id, version]
    );
    return rows[0];
  }

  /** 回退到指定版本：把旧内容写回当前值，并新增一条 source='revert' 的快照 */
  static async revert(id, version, editorId) {
    const target = await this.getRevision(id, version);
    if (!target) return null;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE announcements SET title = ?, content = ?, is_pinned = ? WHERE id = ?', [
        target.title, target.content, target.is_pinned ? 1 : 0, id,
      ]);
      const newVersion = await this.addRevision(id, {
        title: target.title,
        content: target.content,
        is_pinned: target.is_pinned,
        editor_id: editorId,
        source: 'revert',
      }, conn);
      await conn.commit();
      return {
        id,
        version: newVersion,
        revertedFrom: version,
        title: target.title,
        content: target.content,
        is_pinned: !!target.is_pinned,
      };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  static async delete(id) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      // 修订历史随公告一起删除（没有公告的孤立历史没有意义）
      await conn.query('DELETE FROM announcement_revisions WHERE announcement_id = ?', [id]);
      const [result] = await conn.query('DELETE FROM announcements WHERE id = ?', [id]);
      await conn.commit();
      return result.affectedRows > 0;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

module.exports = Announcement;
