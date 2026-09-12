const db = require('../config/database');
const { encodeCursor } = require('../shared/paging');

class Photo {
  /**
   * @param {object} p
   * @param {string} p.url        原图（客户端已压缩）
   * @param {string} [p.thumb_url]  480px 缩略图（网格/列表用，几乎总是要带）
   * @param {string} [p.medium_url] 1440px 中等图（查看器用）
   */
  static async create({
    album_id, url, thumb_url = null, medium_url = null,
    width = null, height = null, size = null, mime = null,
    description, uploader_id, auto_approve = false
  }) {
    const isApproved = auto_approve ? true : false;
    const [result] = await db.query(
      `INSERT INTO photos
         (album_id, url, thumb_url, medium_url, width, height, size, mime, description, uploader_id, is_approved, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        album_id, url, thumb_url, medium_url, width, height, size, mime,
        description || '', uploader_id, isApproved,
        auto_approve ? uploader_id : null, auto_approve ? new Date() : null
      ]
    );
    return result.insertId;
  }

  /** 相册封面用的缩略图（有 thumb 用 thumb，没有回落到原图） */
  static async getCoverUrls(albumIds = []) {
    if (!albumIds.length) return {};
    const [rows] = await db.query(
      `SELECT album_id, url, thumb_url FROM photos
        WHERE album_id IN (?) AND is_approved = true
        ORDER BY created_at DESC`,
      [albumIds]
    );
    const map = {};
    for (const r of rows) {
      if (!map[r.album_id]) map[r.album_id] = r.thumb_url || r.url;
    }
    return map;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT p.*, u.name AS uploader_name
       FROM photos p
       LEFT JOIN users u ON p.uploader_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0];
  }

  /** 获取相册下照片，普通用户只看 approved，管理员可看全部 */
  static async getByAlbum(album_id, includePending = false) {
    const where = includePending
      ? 'WHERE p.album_id = ?'
      : 'WHERE p.album_id = ? AND p.is_approved = true';
    const [rows] = await db.query(
      `SELECT p.*, u.name AS uploader_name
       FROM photos p
       LEFT JOIN users u ON p.uploader_id = u.id
       ${where}
       ORDER BY p.created_at DESC`,
      [album_id]
    );
    return rows;
  }

  /**
   * 相册照片**游标分页**（P1-3）
   *
   * 为什么用游标而不是 OFFSET：照片是持续追加的数据，`OFFSET 300 LIMIT 30` 在
   * 大相册上要扫过前 300 行；改用 `(created_at, id)` 倒序的游标条件后，
   * 每次都从上一次的位置继续走索引（idx_photos_album_approved）。
   *
   * @param {number|string} album_id
   * @param {object} opts
   * @param {boolean} [opts.includePending=false] 是否含待审核（有审核权的人/相册创建者看全部）
   * @param {number} opts.limit 本页条数（内部多取 1 条判断 hasMore）
   * @param {{created_at:string, id:number}|null} [opts.cursor] 上一页返回的 nextCursor 解码值
   * @returns {Promise<{photos:Array, hasMore:boolean, nextCursor:string|null}>}
   */
  static async getAlbumPage(album_id, { includePending = false, limit, cursor = null } = {}) {
    const size = Math.max(1, Math.trunc(Number(limit) || 1));
    const where = ['p.album_id = ?'];
    const params = [album_id];
    if (!includePending) where.push('p.is_approved = true');
    // 游标条件与 ORDER BY 严格对应（created_at DESC, id DESC），避免翻页重复/漏项
    if (cursor && cursor.created_at && cursor.id) {
      where.push('(p.created_at < ? OR (p.created_at = ? AND p.id < ?))');
      params.push(cursor.created_at, cursor.created_at, cursor.id);
    }
    // 多取 1 条：有第 size+1 条就说明还有下一页，省掉一次 COUNT(*)
    params.push(size + 1);

    const [rows] = await db.query(
      `SELECT p.*, u.name AS uploader_name
       FROM photos p
       LEFT JOIN users u ON p.uploader_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ?`,
      params
    );

    const hasMore = rows.length > size;
    const photos = hasMore ? rows.slice(0, size) : rows;
    const last = photos[photos.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ created_at: last.created_at, id: last.id })
      : null;
    return { photos, hasMore, nextCursor };
  }

  static async getPendingPhotos() {
    const [rows] = await db.query(
      `SELECT p.*, u.name AS uploader_name, a.name AS album_name
       FROM photos p
       LEFT JOIN users u ON p.uploader_id = u.id
       LEFT JOIN albums a ON p.album_id = a.id
       WHERE p.is_approved = false
       ORDER BY p.created_at DESC`
    );
    return rows;
  }

  static async approve(id, approver_id) {
    const [result] = await db.query(
      'UPDATE photos SET is_approved = true, approved_by = ?, approved_at = NOW() WHERE id = ?',
      [approver_id, id]
    );
    return result.affectedRows > 0;
  }

  static async reject(id) {
    const [result] = await db.query('DELETE FROM photos WHERE id = ? AND is_approved = false', [id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM photos WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Photo;
