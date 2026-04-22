const db = require('../config/database');

class Album {
  static async create({ name, description, creator_id, permission = 0 }) {
    const [result] = await db.query(
      'INSERT INTO albums (name, description, creator_id, permission) VALUES (?, ?, ?, ?)',
      [name, description || '', creator_id, permission]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS creator_name,
              (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id AND p.is_approved = true) AS photo_count,
              (SELECT p.url FROM photos p WHERE p.album_id = a.id AND p.is_approved = true ORDER BY p.created_at DESC LIMIT 1) AS cover_url
       FROM albums a
       LEFT JOIN users u ON a.creator_id = u.id
       WHERE a.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS creator_name,
              (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id AND p.is_approved = true) AS photo_count,
              (SELECT p.url FROM photos p WHERE p.album_id = a.id AND p.is_approved = true ORDER BY p.created_at DESC LIMIT 1) AS cover_url
       FROM albums a
       LEFT JOIN users u ON a.creator_id = u.id
       ORDER BY a.created_at DESC`
    );
    return rows;
  }

  static async delete(id) {
    await db.query('DELETE FROM photos WHERE album_id = ?', [id]);
    const [result] = await db.query('DELETE FROM albums WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Album;
