const Vote = require('../models/Vote');

const { isAdmin } = require('../shared/constants');

class VoteController {
  static async createVote(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const { title, description, type, start_time, end_time, options, visible_scope, vote_scope } = req.body || {};
      // Validate scopes
      const validScopes = ['all', 'admin'];
      if (visible_scope && !validScopes.includes(visible_scope)) {
        return res.status(400).json({ success: false, error: '可见范围取值无效' });
      }
      if (vote_scope && !validScopes.includes(vote_scope)) {
        return res.status(400).json({ success: false, error: '可投范围取值无效' });
      }
      if (!title) return res.status(400).json({ success: false, error: '标题必填' });
      if (!Array.isArray(options) || options.filter(o => o && o.trim()).length < 2) {
        return res.status(400).json({ success: false, error: '至少需要两个有效选项' });
      }
      if (!start_time || !end_time) {
        return res.status(400).json({ success: false, error: '起止时间必填' });
      }
      if (new Date(end_time) <= new Date(start_time)) {
        return res.status(400).json({ success: false, error: '结束时间必须晚于开始时间' });
      }

      const id = await Vote.create({
        title,
        description,
        type: type === 'multiple' ? 'multiple' : 'single',
        creator_id: req.user.id,
        start_time,
        end_time,
        options,
        visible_scope: visible_scope || 'all',
        vote_scope: vote_scope || 'all'
      });
      res.json({ success: true, id, message: '投票发布成功' });
    } catch (e) {
      console.error('创建投票失败:', e);
      res.status(500).json({ success: false, error: '创建投票失败' });
    }
  }

  static async listVotes(req, res) {
    try {
      const votes = await Vote.getAll();
      // Filter by visible_scope: non-admin only sees 'all'
      const filtered = isAdmin(req.user)
        ? votes
        : votes.filter(v => v.visible_scope === 'all' || !v.visible_scope);
      res.json({ success: true, votes: filtered });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取投票列表失败' });
    }
  }

  static async getVoteDetail(req, res) {
    try {
      const vote = await Vote.findById(req.params.id);
      if (!vote) return res.status(404).json({ success: false, error: '投票不存在' });
      // Visibility check
      if (vote.visible_scope === 'admin' && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '无权查看' });
      }
      const options = await Vote.getOptions(req.params.id);
      const myChoices = await Vote.getUserChoices(req.params.id, req.user.id);

      // 计算百分比
      const total = options.reduce((s, o) => s + Number(o.vote_count || 0), 0);
      const optionsWithRate = options.map(o => ({
        ...o,
        rate: total > 0 ? Math.round((Number(o.vote_count) / total) * 100) : 0
      }));

      res.json({
        success: true,
        vote,
        options: optionsWithRate,
        my_choices: myChoices,
        total_votes: total
      });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取投票详情失败' });
    }
  }

  static async castVote(req, res) {
    try {
      const voteId = req.params.id;
      const { option_ids } = req.body || {};
      if (!Array.isArray(option_ids) || option_ids.length === 0) {
        return res.status(400).json({ success: false, error: '请选择选项' });
      }

      const vote = await Vote.findById(voteId);
      if (!vote) return res.status(404).json({ success: false, error: '投票不存在' });
      if (!vote.is_active) return res.status(400).json({ success: false, error: '该投票已关闭' });

      // Vote scope check
      if (vote.vote_scope === 'admin' && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '仅班干部可参与此投票' });
      }

      const now = new Date();
      if (now < new Date(vote.start_time)) {
        return res.status(400).json({ success: false, error: '投票尚未开始' });
      }
      if (now > new Date(vote.end_time)) {
        return res.status(400).json({ success: false, error: '投票已结束' });
      }
      const isSingle = vote.type === 'single' || vote.type === '单选';
      if (isSingle && option_ids.length > 1) {
        return res.status(400).json({ success: false, error: '该投票为单选' });
      }

      // 校验 option_ids 都属于该 vote
      const opts = await Vote.getOptions(voteId);
      const validIds = new Set(opts.map(o => o.id));
      const sanitized = option_ids.filter(id => validIds.has(Number(id))).map(Number);
      if (sanitized.length === 0) {
        return res.status(400).json({ success: false, error: '选项无效' });
      }

      await Vote.cast({
        vote_id: voteId,
        user_id: req.user.id,
        option_ids: sanitized,
        type: isSingle ? 'single' : 'multiple'
      });
      res.json({ success: true, message: '投票成功' });
    } catch (e) {
      console.error('投票失败:', e);
      res.status(500).json({ success: false, error: '投票失败' });
    }
  }

  static async closeVote(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const ok = await Vote.close(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '投票不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '关闭投票失败' });
    }
  }
}

module.exports = VoteController;
