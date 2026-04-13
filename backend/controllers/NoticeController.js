const Notice = require('../models/Notice');

class NoticeController {
  static async createNotice(req, res) {
    try {
      const noticeId = await Notice.create({
        creator_id: req.user.id,
        ...req.body
      });
      
      res.json({ success: true, noticeId, message: '通知发布成功' });
    } catch (error) {
      console.error('通知发布失败:', error);
      res.status(500).json({ success: false, error: '通知发布失败' });
    }
  }

  static async getNotices(req, res) {
    try {
      const notices = await Notice.getAll();
      res.json({ success: true, notices });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取通知失败' });
    }
  }

  static async getNoticeDetail(req, res) {
    try {
      const notice = await Notice.findById(req.params.id);
      if (!notice) {
        return res.status(404).json({ success: false, error: '通知不存在' });
      }
      
      // 标记为已读
      await Notice.markAsRead(req.params.id, req.user.id);
      
      res.json({ success: true, notice });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取通知详情失败' });
    }
  }

  static async getUnreadCount(req, res) {
    try {
      const count = await Notice.getUnreadCount(req.user.id);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取未读通知数失败' });
    }
  }
}

module.exports = NoticeController;