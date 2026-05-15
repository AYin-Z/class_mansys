const Notice = require('../models/Notice');

class NoticeController {
  static async createNotice(req, res) {
    try {
      const { title, content, type, priority, is_pinned, attachments } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ success: false, error: '标题和内容必填' });
      }

      const noticeId = await Notice.create({
        title,
        content,
        type: type || '日常',
        priority: typeof priority === 'number' ? priority : 0,
        is_pinned: !!is_pinned,
        attachments,
        creator_id: req.user.id
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
      console.error('获取通知列表失败:', error);
      res.status(500).json({ success: false, error: '获取通知失败' });
    }
  }

  static async getNoticeDetail(req, res) {
    try {
      const notice = await Notice.findById(req.params.id);
      if (!notice) {
        return res.status(404).json({ success: false, error: '通知不存在' });
      }

      // 标记为已读（容错，失败不影响详情返回）
      try { await Notice.markAsRead(req.params.id, req.user.id); } catch (_) { /* ignore */ }

      res.json({ success: true, notice });
    } catch (error) {
      console.error('获取通知详情失败:', error);
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

  static async updateNotice(req, res) {
    try {
      const { id } = req.params;
      const { title, content, summary, type, priority, is_pinned, attachments } = req.body || {};

      // Check that body is not completely empty
      const fields = { title, content, summary, type, priority, is_pinned, attachments };
      const hasFields = Object.values(fields).some(v => v !== undefined);
      if (!hasFields) {
        return res.status(400).json({ success: false, error: '没有可更新的字段' });
      }

      const affected = await Notice.update(id, fields);
      if (!affected) {
        return res.status(404).json({ success: false, error: '通知不存在' });
      }

      const notice = await Notice.findById(id);
      res.json({ success: true, notice });
    } catch (error) {
      console.error('通知更新失败:', error);
      res.status(500).json({ success: false, error: '通知更新失败' });
    }
  }

  static async deleteNotice(req, res) {
    try {
      const ok = await Notice.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '通知不存在' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: '删除通知失败' });
    }
  }
}

module.exports = NoticeController;
