const Message = require('../models/Message');

const { isAdmin } = require('../shared/constants');

class MessageController {
  static async list(req, res) {
    try {
      const { target_type, target_id } = req.query;
      if (!target_type || !target_id) {
        return res.status(400).json({ success: false, error: 'target_type/target_id 必填' });
      }
      const messages = await Message.getByTarget(target_type, Number(target_id));
      res.json({ success: true, messages });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取留言失败' });
    }
  }

  static async create(req, res) {
    try {
      const { content, target_id, target_type, parent_id } = req.body || {};
      if (!content || !target_id || !target_type) {
        return res.status(400).json({ success: false, error: 'content/target_id/target_type 必填' });
      }
      const id = await Message.create({
        content: content.trim(),
        user_id: req.user.id,
        target_id: Number(target_id),
        target_type,
        parent_id: parent_id ? Number(parent_id) : null
      });
      res.json({ success: true, id });
    } catch (e) {
      res.status(500).json({ success: false, error: '留言失败' });
    }
  }

  static async remove(req, res) {
    try {
      const item = await Message.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '留言不存在' });
      if (item.user_id !== req.user.id && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '无权删除' });
      }
      await Message.delete(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除失败' });
    }
  }
}

module.exports = MessageController;
