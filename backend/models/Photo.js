const db = require('../config/database');

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
