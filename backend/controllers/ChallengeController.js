const Challenge = require('../models/Challenge');

const ADMIN_ROLES = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const isAdmin = (user) => user && ADMIN_ROLES.has(Number(user.role));

class ChallengeController {
  static async create(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权创建擂台' });
      const { name, type, description } = req.body || {};
      if (!name || !type || !description) {
        return res.status(400).json({ success: false, error: 'name/type/description 必填' });
      }
      const id = await Challenge.create({ name, type, description });
      res.json({ success: true, id });
    } catch (e) {
      res.status(500).json({ success: false, error: '创建失败' });
    }
  }

  static async list(req, res) {
    try {
      const challenges = await Challenge.getAll();
      res.json({ success: true, challenges });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取列表失败' });
    }
  }

  static async detail(req, res) {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) return res.status(404).json({ success: false, error: '擂台不存在' });
      const records = await Challenge.getRecordsByChallenge(req.params.id);
      let applications = [];
      if (isAdmin(req.user)) {
        applications = await Challenge.getApplicationsByChallenge(req.params.id);
      }
      res.json({ success: true, challenge, records, applications });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取详情失败' });
    }
  }

  static async apply(req, res) {
    try {
      const id = await Challenge.apply({
        challenge_id: req.params.id,
        user_id: req.user.id
      });
      res.json({ success: true, id, message: '申请已提交，等待审核' });
    } catch (e) {
      res.status(500).json({ success: false, error: '申请失败' });
    }
  }

  static async myApplications(req, res) {
    try {
      const applications = await Challenge.getMyApplications(req.user.id);
      res.json({ success: true, applications });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取失败' });
    }
  }

  static async approve(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权审批' });
      const { status } = req.body || {};
      if (![1, 2].includes(Number(status))) {
        return res.status(400).json({ success: false, error: 'status 必须为 1/2' });
      }
      const ok = await Challenge.approveApplication(req.params.applicationId, {
        approver_id: req.user.id,
        status: Number(status)
      });
      if (!ok) return res.status(404).json({ success: false, error: '申请不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '审批失败' });
    }
  }

  static async record(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权登记' });
      const { challenger_id, champion_id, result, notes } = req.body || {};
      if (!challenger_id || !champion_id || !result) {
        return res.status(400).json({ success: false, error: 'challenger_id/champion_id/result 必填' });
      }
      const id = await Challenge.createRecord({
        challenge_id: req.params.id,
        challenger_id: Number(challenger_id),
        champion_id: Number(champion_id),
        result, notes
      });
      // 挑战成功 → 切换擂主
      if (result === '挑战成功' || result === 'win') {
        await Challenge.setChampion(req.params.id, Number(challenger_id));
      }
      res.json({ success: true, id });
    } catch (e) {
      console.error('登记记录失败:', e);
      res.status(500).json({ success: false, error: '登记失败' });
    }
  }
}

module.exports = ChallengeController;
