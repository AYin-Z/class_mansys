const path = require('path');
const Album = require('../models/Album');
const Photo = require('../models/Photo');

const { isAdmin } = require('../shared/constants');

class AlbumController {
  /* ---------- 相册 ---------- */

  static async createAlbum(req, res) {
    try {
      const { name, description, permission } = req.body || {};
      if (!name) return res.status(400).json({ success: false, error: '相册名称必填' });
      const id = await Album.create({
        name,
        description,
        creator_id: req.user.id,
        permission: typeof permission === 'number' ? permission : 0
      });
      res.json({ success: true, id, message: '相册创建成功' });
    } catch (e) {
      console.error('创建相册失败:', e);
      res.status(500).json({ success: false, error: '创建相册失败' });
    }
  }

  static async listAlbums(req, res) {
    try {
      const albums = await Album.getAll();
      res.json({ success: true, albums });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取相册失败' });
    }
  }

  static async getAlbumDetail(req, res) {
    try {
      const album = await Album.findById(req.params.id);
      if (!album) return res.status(404).json({ success: false, error: '相册不存在' });
      const includePending = isAdmin(req.user);
      const photos = await Photo.getByAlbum(req.params.id, includePending);
      res.json({ success: true, album, photos });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取相册详情失败' });
    }
  }

  static async deleteAlbum(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const ok = await Album.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '相册不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除相册失败' });
    }
  }

  /* ---------- 照片 ---------- */

  static async uploadPhotos(req, res) {
    try {
      const { album_id, urls, description } = req.body || {};
      if (!album_id || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ success: false, error: '相册ID和图片URL列表必填' });
      }
      const album = await Album.findById(album_id);
      if (!album) return res.status(404).json({ success: false, error: '相册不存在' });

      const autoApprove = isAdmin(req.user) || Number(album.creator_id) === Number(req.user.id);
      const ids = [];
      for (const url of urls) {
        const id = await Photo.create({
          album_id,
          url,
          description,
          uploader_id: req.user.id,
          auto_approve: autoApprove
        });
        ids.push(id);
      }

      res.json({
        success: true,
        ids,
        autoApproved: autoApprove,
        message: autoApprove ? '上传成功' : '上传成功，等待审核'
      });
    } catch (e) {
      console.error('上传照片失败:', e);
      res.status(500).json({ success: false, error: '上传照片失败' });
    }
  }

  static async uploadPhotoFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择图片' });
      }
      const file = req.file;
      const url = `/uploads/albums/${file.filename}`;
      res.json({
        success: true,
        url,
        filename: file.originalname,
        size: file.size
      });
    } catch (e) {
      console.error('图片上传失败:', e);
      res.status(500).json({ success: false, error: '图片上传失败' });
    }
  }

  static async getPendingPhotos(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const photos = await Photo.getPendingPhotos();
      res.json({ success: true, photos });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取待审核照片失败' });
    }
  }

  static async approvePhoto(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const ok = await Photo.approve(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ success: false, error: '照片不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '审核照片失败' });
    }
  }

  static async rejectPhoto(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const ok = await Photo.reject(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '照片不存在或已审核' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '驳回照片失败' });
    }
  }
}

module.exports = AlbumController;
