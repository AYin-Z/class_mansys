const Homework = require('../models/Homework');

const { isAdmin } = require('../shared/constants');

class HomeworkController {
  static async create(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权发布作业' });
      const { title, description, deadline, attachments } = req.body || {};
      if (!title || !description || !deadline) {
        return res.status(400).json({ success: false, error: 'title/description/deadline 必填' });
      }
      const id = await Homework.create({
        title, description, deadline, attachments,
        creator_id: req.user.id
      });
      res.json({ success: true, id });
    } catch (e) {
      console.error('发布作业失败:', e);
      res.status(500).json({ success: false, error: '发布失败' });
    }
  }

  static async list(req, res) {
    try {
      const homeworks = await Homework.getAll();
      res.json({ success: true, homeworks });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取作业列表失败' });
    }
  }

  static async detail(req, res) {
    try {
      const homework = await Homework.findById(req.params.id);
      if (!homework) return res.status(404).json({ success: false, error: '作业不存在' });
      const mySubmission = await Homework.getMySubmission(req.params.id, req.user.id);
      let submissions = [];
      if (isAdmin(req.user)) {
        submissions = await Homework.getSubmissionsByHomework(req.params.id);
      }
      res.json({ success: true, homework, mySubmission, submissions });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取作业详情失败' });
    }
  }

  static async submit(req, res) {
    try {
      const { file_url, file_name } = req.body || {};
      if (!file_url || !file_name) {
        return res.status(400).json({ success: false, error: 'file_url/file_name 必填' });
      }
      const id = await Homework.submit({
        homework_id: req.params.id,
        user_id: req.user.id,
        file_url, file_name
      });
      res.json({ success: true, id });
    } catch (e) {
      console.error('提交作业失败:', e);
      res.status(500).json({ success: false, error: '提交失败' });
    }
  }

  static async grade(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权批改' });
      const { score, feedback } = req.body || {};
      const ok = await Homework.grade(req.params.submissionId, { score: Number(score) || 0, feedback });
      if (!ok) return res.status(404).json({ success: false, error: '提交记录不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '批改失败' });
    }
  }

  static async remove(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权删除' });
      const ok = await Homework.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '作业不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除失败' });
    }
  }

  static async pendingCount(req, res) {
    try {
      const count = await Homework.getPendingCount(req.user.id);
      res.json({ success: true, count });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取待完成作业数失败' });
    }
  }
}

module.exports = HomeworkController;
