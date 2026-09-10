const Psychological = require('../models/Psychological');

// 心理干预只允许：本人 + 心理委员/辅导员/区队长 查看
// 简化处理：管理员（role>0）即可处理；本人可看自己。
const { isAdmin } = require('../shared/constants');
const { resolveScope, filterByOwnClassScope, canAccessOwnClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');

class PsychologicalController {
  static async create(req, res) {
    try {
      const { content } = req.body || {};
      if (!content || content.trim().length < 3) {
        return res.status(400).json({ success: false, error: '请填写申请内容' });
      }
      const scope = await resolveScope(req.user);
      const id = await Psychological.create({ user_id: req.user.id, content: content.trim() });
      await stampClassId('psychological_applications', id, scope.writeClassId);
      res.json({ success: true, id, message: '已提交，相关老师会尽快与你联系' });
    } catch (e) {
      console.error('提交心理申请失败:', e);
      res.status(500).json({ success: false, error: '提交失败' });
    }
  }

  static async listMine(req, res) {
    try {
      const list = await Psychological.getByUser(req.user.id);
      res.json({ success: true, applications: list });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取列表失败' });
    }
  }

  static async listAll(req, res) {
    try {
      const filters = {};
      if (req.query.status !== undefined) filters.status = Number(req.query.status);
      const scope = await resolveScope(req.user);
      const list = filterByOwnClassScope(await Psychological.getAll(filters), scope);
      res.json({ success: true, applications: list });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取列表失败' });
    }
  }

  static async detail(req, res) {
    try {
      const item = await Psychological.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '申请不存在' });
      // 仅本人或本区队管理员（心理为敏感数据，不做中队平行）
      if (item.user_id !== req.user.id && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '无权查看' });
      }
      if (item.user_id !== req.user.id) {
        const scope = await resolveScope(req.user);
        if (!canAccessOwnClassRecord(item, scope)) {
          return res.status(403).json({ success: false, error: '无权查看该区队的心理申请' });
        }
      }
      res.json({ success: true, application: item });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取详情失败' });
    }
  }

  static async handle(req, res) {
    try {
      const existing = await Psychological.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '申请不存在' });
      const handleScope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(existing, handleScope)) {
        return res.status(403).json({ success: false, error: '无权处理该区队的心理申请' });
      }
      const { status, handler_notes } = req.body || {};
      if (![0, 1, 2].includes(Number(status))) {
        return res.status(400).json({ success: false, error: 'status 必须为 0/1/2' });
      }
      const ok = await Psychological.handle(req.params.id, {
        handler_id: req.user.id,
        status: Number(status),
        handler_notes
      });
      if (!ok) return res.status(404).json({ success: false, error: '申请不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '处理失败' });
    }
  }
}

module.exports = PsychologicalController;
