const Announcement = require('../models/Announcement');
const Resource = require('../models/Resource');

class AnnouncementController {
  /* ---------- 公告 ---------- */

  static async createAnnouncement(req, res) {
    try {
      const { title, content } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ success: false, error: '标题和内容必填' });
      }
      const id = await Announcement.create({ title, content, creator_id: req.user.id });
      res.json({ success: true, id, message: '公告发布成功' });
    } catch (e) {
      console.error('公告发布失败:', e);
      res.status(500).json({ success: false, error: '公告发布失败' });
    }
  }

  static async listAnnouncements(req, res) {
    try {
      const announcements = await Announcement.getAll();
      res.json({ success: true, announcements });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取公告失败' });
    }
  }

  static async getAnnouncementDetail(req, res) {
    try {
      const item = await Announcement.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '公告不存在' });
      res.json({ success: true, announcement: item });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取公告详情失败' });
    }
  }

  static async deleteAnnouncement(req, res) {
    try {
      const ok = await Announcement.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '公告不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除公告失败' });
    }
  }

  /* ---------- 资源共享 ---------- */

  static async createResource(req, res) {
    try {
      const { name, type, url, size, category, description } = req.body || {};
      if (!name || !url) {
        return res.status(400).json({ success: false, error: '资源名称和URL必填' });
      }
      const id = await Resource.create({
        name, type: type || 'other', url, size, category, description,
        uploader_id: req.user.id
      });
      res.json({ success: true, id, message: '资源上传成功' });
    } catch (e) {
      console.error('资源上传失败:', e);
      res.status(500).json({ success: false, error: '资源上传失败' });
    }
  }

  static async listResources(req, res) {
    try {
      const { category } = req.query;
      const resources = await Resource.getAll(category);
      res.json({ success: true, resources });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取资源失败' });
    }
  }

  static async deleteResource(req, res) {
    try {
      const ok = await Resource.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '资源不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除资源失败' });
    }
  }
}

module.exports = AnnouncementController;
