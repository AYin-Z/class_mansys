const Lottery = require('../models/Lottery');

const { isAdmin } = require('../shared/constants');

class LotteryController {
  static async create(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权创建抽奖' });
      const { name, description, rules, start_time, end_time } = req.body || {};
      if (!name || !rules || !start_time || !end_time) {
        return res.status(400).json({ success: false, error: 'name/rules/start_time/end_time 必填' });
      }
      const id = await Lottery.create({
        name, description, rules,
        creator_id: req.user.id,
        start_time, end_time
      });
      res.json({ success: true, id });
    } catch (e) {
      res.status(500).json({ success: false, error: '创建失败' });
    }
  }

  static async list(req, res) {
    try {
      const lotteries = await Lottery.getAll();
      res.json({ success: true, lotteries });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取列表失败' });
    }
  }

  static async detail(req, res) {
    try {
      const lottery = await Lottery.findById(req.params.id);
      if (!lottery) return res.status(404).json({ success: false, error: '抽奖不存在' });
      const participants = await Lottery.getParticipants(req.params.id);
      const myRecord = await Lottery.hasJoined(req.params.id, req.user.id);
      res.json({ success: true, lottery, participants, myRecord });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取详情失败' });
    }
  }

  static async join(req, res) {
    try {
      const lottery = await Lottery.findById(req.params.id);
      if (!lottery) return res.status(404).json({ success: false, error: '抽奖不存在' });
      if (!lottery.is_active) return res.status(400).json({ success: false, error: '抽奖已结束' });
      const id = await Lottery.join({ lottery_id: req.params.id, user_id: req.user.id });
      if (!id) return res.status(400).json({ success: false, error: '已参与，无法重复参加' });
      res.json({ success: true, id });
    } catch (e) {
      res.status(500).json({ success: false, error: '参与失败' });
    }
  }

  static async draw(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权开奖' });
      const { winner_count, prize } = req.body || {};
      const ids = await Lottery.draw(req.params.id, { winner_count, prize });
      res.json({ success: true, winner_participant_ids: ids });
    } catch (e) {
      res.status(500).json({ success: false, error: '开奖失败' });
    }
  }

  static async close(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权关闭' });
      const ok = await Lottery.close(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '抽奖不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '关闭失败' });
    }
  }
}

module.exports = LotteryController;
