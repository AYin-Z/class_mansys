const crypto = require('crypto');
const Suggestion = require('../models/Suggestion');

const { isAdmin } = require('../shared/constants');

class SuggestionController {
  static async submit(req, res) {
    try {
      const { content, category } = req.body || {};
      if (!content || content.trim().length < 5) {
        return res.status(400).json({ success: false, error: '建议内容至少 5 个字' });
      }
      // 不记录 user_id，保证匿名；返回 viewToken 作为「我的提交」凭据，避免按 id 枚举
      const viewToken = crypto.randomBytes(16).toString('hex');
      const id = await Suggestion.create({ content: content.trim(), category, viewToken });
      res.json({ success: true, id, viewToken, message: '提交成功，感谢反馈' });
    } catch (e) {
      console.error('提交建议失败:', e);
      res.status(500).json({ success: false, error: '提交失败' });
    }
  }

  /** 管理员：查询全部建议（可按状态/分类筛选） */
  static async listAll(req, res) {
    try {
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
      // 只能凭提交时下发的 view_token 反查，避免用 id 枚举他人/匿名建议
      if (!isAdmin(req.user) && (!req.query.tokens)) {
        return res.status(403).json({ success: false, error: '缺少凭据' });
      }
      let tokens = req.query.tokens;
      if (typeof tokens === 'string') tokens = tokens.split(',').map(s => s.trim()).filter(Boolean);
      if (!Array.isArray(tokens) || tokens.length === 0) {
        return res.json({ success: true, suggestions: [] });
      }
      const suggestions = await Suggestion.findByTokens(tokens.slice(0, 200));
      res.json({ success: true, suggestions });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取建议失败' });
    }
  }

  static async getDetail(req, res) {
    try {
      const item = await Suggestion.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '建议不存在' });
      res.json({ success: true, suggestion: item });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取建议详情失败' });
    }
  }

  static async handle(req, res) {
    try {
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
