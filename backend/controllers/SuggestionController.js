const Suggestion = require('../models/Suggestion');

const { isAdmin } = require('../shared/constants');

class SuggestionController {
  static async submit(req, res) {
    try {
      const { content, category } = req.body || {};
      if (!content || content.trim().length < 5) {
        return res.status(400).json({ success: false, error: '建议内容至少 5 个字' });
      }
      const id = await Suggestion.create({ content: content.trim(), category });
      // 不记录 user_id，保证匿名；返回 id 让前端本地存「我的提交」
      res.json({ success: true, id, message: '提交成功，感谢反馈' });
    } catch (e) {
      console.error('提交建议失败:', e);
      res.status(500).json({ success: false, error: '提交失败' });
    }
  }

  /** 管理员：查询全部建议（可按状态/分类筛选） */
  static async listAll(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const filters = {};
      if (req.query.status !== undefined) filters.status = Number(req.query.status);
      if (req.query.category) filters.category = req.query.category;
      const suggestions = await Suggestion.getAll(filters);
      res.json({ success: true, suggestions });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取建议失败' });
    }
  }

  /** 用户：根据 id 列表查「我的提交」状态 */
  static async listMine(req, res) {
    try {
      let ids = req.query.ids;
      if (typeof ids === 'string') ids = ids.split(',').map(s => Number(s)).filter(Number.isFinite);
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.json({ success: true, suggestions: [] });
      }
      const suggestions = await Suggestion.getByIds(ids);
      res.json({ success: true, suggestions });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取建议失败' });
    }
  }

  static async getDetail(req, res) {
    try {
      const item = await Suggestion.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '建议不存在' });
      // 普通用户也能看，因为通过 id 才能查到（匿名场景）
      res.json({ success: true, suggestion: item });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取建议详情失败' });
    }
  }

  static async handle(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const { status, handler_notes } = req.body || {};
      if (![0, 1, 2].includes(Number(status))) {
        return res.status(400).json({ success: false, error: 'status 必须为 0/1/2' });
      }
      const ok = await Suggestion.handle(req.params.id, {
        handler_id: req.user.id,
        status: Number(status),
        handler_notes
      });
      if (!ok) return res.status(404).json({ success: false, error: '建议不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '处理建议失败' });
    }
  }
}

module.exports = SuggestionController;
