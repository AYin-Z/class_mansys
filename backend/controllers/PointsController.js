const Points = require('../models/Points');
const User = require('../models/User');

const { resolveScope, filterByClassScope, filterByOwnClassScope, canAccessClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');

class PointsController {
  static async listMine(req, res) {
    try {
      const records = await Points.getByUser(req.user.id);
      const total = await Points.getTotalByUser(req.user.id);
      res.json({ success: true, records, total });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取我的积分失败' });
    }
  }

  static async ranking(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const ranking = filterByClassScope(await Points.getRanking(Number(req.query.limit) || 50), scope);
      res.json({ success: true, ranking });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取排行失败' });
    }
  }

  static async listAll(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const records = filterByOwnClassScope(await Points.getAll(), scope);
      res.json({ success: true, records });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取记录失败' });
    }
  }

  static async addRecord(req, res) {
    try {
      const { user_id, score, reason } = req.body || {};
      if (!user_id || typeof score === 'undefined' || !reason) {
        return res.status(400).json({ success: false, error: 'user_id/score/reason 必填' });
      }
      const id = await Points.addRecord({
        user_id: Number(user_id),
        score: Number(score),
        reason,
        created_by: req.user.id
      });
      // 作用域：区队管理层只能给本区队学员打分；超管/辅导员不限
      const addScope = await resolveScope(req.user);
      const target = await User.findById(Number(user_id));
      const targetClass = target && target.class_id && target.class_id !== '0' ? target.class_id : null;
      if (Array.isArray(addScope.classIds) && (!targetClass || !addScope.classIds.includes(String(targetClass)))) {
        return res.status(403).json({ success: false, error: '只能给本区队学员加积分' });
      }
      await stampClassId('points', id, targetClass);
      res.json({ success: true, id });
    } catch (e) {
      console.error('加积分失败:', e);
      res.status(500).json({ success: false, error: '操作失败' });
    }
  }

  static async deleteRecord(req, res) {
    try {
      const existing = await Points.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '记录不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessClassRecord(existing, scope)) {
        return res.status(403).json({ success: false, error: '无权删除该积分记录' });
      }
      const ok = await Points.deleteById(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '记录不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除失败' });
    }
  }
}

module.exports = PointsController;
