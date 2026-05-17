const Points = require('../models/Points');

const { isAdmin } = require('../shared/constants');

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
      const ranking = await Points.getRanking(Number(req.query.limit) || 50);
      res.json({ success: true, ranking });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取排行失败' });
    }
  }

  static async listAll(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权查看' });
      const records = await Points.getAll();
      res.json({ success: true, records });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取记录失败' });
    }
  }

  static async addRecord(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权操作' });
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
      res.json({ success: true, id });
    } catch (e) {
      console.error('加积分失败:', e);
      res.status(500).json({ success: false, error: '操作失败' });
    }
  }
}

module.exports = PointsController;
