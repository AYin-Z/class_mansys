const Challenge = require('../models/Challenge');

const { isAdmin } = require('../shared/constants');
const { resolveScope, filterByClassScope, canAccessClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');

class ChallengeController {
  static async create(req, res) {
    try {
      const { name, type, description } = req.body || {};
      if (!name || !type || !description) {
        return res.status(400).json({ success: false, error: 'name/type/description 必填' });
      }
      const scope = await resolveScope(req.user);
      const id = await Challenge.create({ name, type, description });
      await stampClassId('challenges', id, scope.writeClassId);
      res.json({ success: true, id });
    } catch (e) {
      res.status(500).json({ success: false, error: '创建失败' });
    }
  }

  static async list(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const challenges = filterByClassScope(await Challenge.getAll(), scope);
      res.json({ success: true, challenges });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取列表失败' });
    }
  }

  static async detail(req, res) {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) return res.status(404).json({ success: false, error: '擂台不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessClassRecord(challenge, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该擂台' });
      }
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

  static async uploadProof(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: '请选择图片' });
      const url = `/uploads/leaves/${req.file.filename}`;
      res.json({ success: true, url, filename: req.file.originalname, size: req.file.size });
    } catch (e) {
      res.status(500).json({ success: false, error: '上传失败' });
    }
  }

  static async apply(req, res) {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) return res.status(404).json({ success: false, error: '擂台不存在' });
      const applyScope = await resolveScope(req.user);
      if (!canAccessClassRecord(challenge, applyScope)) {
        return res.status(403).json({ success: false, error: '无权挑战该擂台的擂台' });
      }
      const { notes, proof_urls } = req.body || {};
      const id = await Challenge.apply({
        challenge_id: req.params.id,
        user_id: req.user.id,
        proof_urls,
        notes,
      });
      res.json({ success: true, id, message: '申请已提交，等待裁判' });
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

  // 裁判：管理员审核申请并判定结果
  static async judge(req, res) {
    try {
      const { result, notes } = req.body || {};
      if (!result || !['challenger_win', 'champion_win', 'reject'].includes(result)) {
        return res.status(400).json({ success: false, error: 'result 必须为 challenger_win / champion_win / reject' });
      }

      const application = await Challenge.findApplication(req.params.applicationId);
      if (!application) return res.status(404).json({ success: false, error: '申请不存在' });

      const challenge = await Challenge.findById(application.challenge_id);
      if (!challenge) return res.status(404).json({ success: false, error: '擂台不存在' });

      if (result === 'reject') {
        await Challenge.approveApplication(req.params.applicationId, {
          approver_id: req.user.id,
          status: 2,
        });
        return res.json({ success: true, message: '已驳回' });
      }

      // 挑战成功 / 守擂成功 → 创建战绩记录
      const isChallengerWin = result === 'challenger_win';
      const championId = challenge.current_champion_id || application.user_id;
      await Challenge.createRecord({
        challenge_id: application.challenge_id,
        challenger_id: application.user_id,
        champion_id: championId,
        result: isChallengerWin ? '挑战成功' : '守擂成功',
        notes: notes || '',
      });

      // 更新申请状态为通过
      await Challenge.approveApplication(req.params.applicationId, {
        approver_id: req.user.id,
        status: 1,
      });

      // 挑战成功则切换擂主
      if (isChallengerWin) {
        await Challenge.setChampion(application.challenge_id, application.user_id);
      }

      res.json({ success: true, message: isChallengerWin ? '挑战成功！擂主已更换' : '守擂成功！擂主不变' });
    } catch (e) {
      console.error('裁判失败:', e);
      res.status(500).json({ success: false, error: '裁判失败' });
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