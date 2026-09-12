const Homework = require('../models/Homework');

const { isAdmin } = require('../shared/constants');
const { resolveScope, filterByClassScope, classScopeSql, canAccessClassRecord, canAccessOwnClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');
const { parsePaging, buildPageMeta } = require('../shared/paging');

class HomeworkController {
  static async create(req, res) {
    try {
      const { title, description, deadline, attachments } = req.body || {};
      if (!title || !description || !deadline) {
        return res.status(400).json({ success: false, error: 'title/description/deadline 必填' });
      }
      const scope = await resolveScope(req.user);
      const id = await Homework.create({
        title, description, deadline, attachments,
        creator_id: req.user.id
      });
      await stampClassId('homeworks', id, scope.writeClassId);
      res.json({ success: true, id });
    } catch (e) {
      console.error('发布作业失败:', e);
      res.status(500).json({ success: false, error: '发布失败' });
    }
  }

  static async list(req, res) {
    try {
      const scope = await resolveScope(req.user);

      // 分页（P1-3）：不带 page/pageSize = 旧客户端，走原路径，响应字段一字不变。
      const paging = parsePaging(req.query);
      if (!paging.paged) {
        const homeworks = filterByClassScope(await Homework.getAll(), scope);
        return res.json({ success: true, homeworks });
      }

      const scopeFilter = classScopeSql(scope, 'h.class_id');
      const { rows, total } = await Homework.getPage({
        scopeFilter,
        limit: paging.limit,
        offset: paging.offset
      });
      const homeworks = filterByClassScope(rows, scope);
      return res.json({
        success: true,
        homeworks,
        ...buildPageMeta({ page: paging.page, pageSize: paging.pageSize, total })
      });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取作业列表失败' });
    }
  }

  static async detail(req, res) {
    try {
      const homework = await Homework.findById(req.params.id);
      if (!homework) return res.status(404).json({ success: false, error: '作业不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessClassRecord(homework, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该作业' });
      }
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
      const hw = await Homework.findById(req.params.id);
      if (!hw) return res.status(404).json({ success: false, error: '作业不存在' });
      const submitScope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(hw, submitScope)) {
        return res.status(403).json({ success: false, error: '无权提交该作业' });
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
      const existing = await Homework.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '作业不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(existing, scope)) {
        return res.status(403).json({ success: false, error: '无权删除该作业' });
      }
      const ok = await Homework.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '作业不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除失败' });
    }
  }

  /** 上传作业附件（与班费凭证同一套 multer 配置：图片/PDF/Office/zip ≤100MB） */
  static async uploadAttachment(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择文件' });
    }
    return res.json({
      success: true,
      url: '/uploads/resources/' + req.file.filename,
      filename: req.file.originalname,
      size: req.file.size
    });
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
