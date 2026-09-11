const Notice = require('../models/Notice');
const { isAdmin } = require('../shared/constants');
const { resolveScope, filterByClassScope, canAccessClassRecord, canAccessOwnClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');

class NoticeController {
  static async createNotice(req, res) {
    try {
      const { title, content, type, priority, is_pinned, is_todo, attachments } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ success: false, error: '标题和内容必填' });
      }

      const scope = await resolveScope(req.user);
      const id = await Notice.create({
        title,
        content,
        type: type || '日常',
        priority: typeof priority === 'number' ? priority : 0,
        is_pinned: !!is_pinned,
        is_todo: !!is_todo,
        attachments,
        creator_id: req.user.id
      });
      await stampClassId('notices', id, scope.writeClassId);

      res.json({ success: true, data: { id }, message: '通知发布成功' });
    } catch (error) {
      console.error('通知发布失败:', error);
      res.status(500).json({ success: false, error: '通知发布失败' });
    }
  }

  static async getNotices(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const notices = filterByClassScope(await Notice.getAll(req.user.id), scope);
      res.json({ success: true, notices });
    } catch (error) {
      console.error('获取通知列表失败:', error);
      res.status(500).json({ success: false, error: '获取通知失败' });
    }
  }

  static async getNoticeDetail(req, res) {
    try {
      const notice = await Notice.findById(req.params.id);
      if (!notice) {
        return res.status(404).json({ success: false, error: '通知不存在' });
      }
      const scope = await resolveScope(req.user);
      if (!canAccessClassRecord(notice, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该通知' });
      }

      // 标记为已读（容错，失败不影响详情返回）
      try { await Notice.markAsRead(req.params.id, req.user.id); } catch (_) { /* ignore */ }

      // 查询当前用户的待办完成状态
      let isCompleted = false;
      let completion = null;
      if (notice.is_todo) {
        try {
          isCompleted = !!(await Notice.isCompletedBy(req.params.id, req.user.id));
          if (isAdmin({ role: req.user.role })) {
            completion = await Notice.getTodoCompletionStatus(req.params.id);
          }
        } catch (_) { /* ignore */ }
      }

      res.json({ success: true, notice: { ...notice, is_completed: isCompleted }, completion });
    } catch (error) {
      console.error('获取通知详情失败:', error);
      res.status(500).json({ success: false, error: '获取通知详情失败' });
    }
  }

  static async getUnreadCount(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const classId = scope.classId || (Array.isArray(scope.classIds) ? scope.classIds[0] : null);
      const count = await Notice.getUnreadCount(req.user.id, classId);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取未读通知数失败' });
    }
  }

  static async completeTodo(req, res) {
    try {
      const ok = await Notice.markComplete(req.params.id, req.user.id);
      if (!ok) {
        return res.status(400).json({ success: false, error: '已完成或通知不存在' });
      }
      res.json({ success: true, message: '已标记完成' });
    } catch (error) {
      console.error('待办完成失败:', error);
      res.status(500).json({ success: false, error: '操作失败' });
    }
  }

  static async getTodoCount(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const classId = scope.classId || (Array.isArray(scope.classIds) ? scope.classIds[0] : null);
      const count = await Notice.getTodoCount(req.user.id, classId);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取待办数失败' });
    }
  }

  /** 获取待办通知的完成名单 */
  static async getTodoCompletion(req, res) {
    try {
      // 完成名单包含全班姓名/学号：仅本区队干部/管理员可见（权限由路由 VIEW_ROSTER 把关）
      const notice = await Notice.findById(req.params.id);
      if (!notice) return res.status(404).json({ success: false, error: '通知不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(notice, scope)) {
        return res.status(403).json({ success: false, error: '无权查看其他区队的完成名单' });
      }
      const result = await Notice.getTodoCompletionStatus(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取完成状态失败' });
    }
  }

  static async updateNotice(req, res) {
    try {
      const { id } = req.params;
      const { title, content, summary, type, priority, is_pinned, is_todo, attachments } = req.body || {};

      // Check that body is not completely empty
      const fields = { title, content, summary, type, priority, is_pinned, is_todo, attachments };
      const hasFields = Object.values(fields).some(v => v !== undefined);
      if (!hasFields) {
        return res.status(400).json({ success: false, error: '没有可更新的字段' });
      }

      const existing = await Notice.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: '通知不存在' });
      }
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(existing, scope)) {
        return res.status(403).json({ success: false, error: '无权修改该通知' });
      }

      const affected = await Notice.update(id, fields);
      if (!affected) {
        return res.status(404).json({ success: false, error: '通知不存在' });
      }

      const notice = await Notice.findById(id);
      res.json({ success: true, notice });
    } catch (error) {
      console.error('通知更新失败:', error);
      res.status(500).json({ success: false, error: '通知更新失败' });
    }
  }

  static async deleteNotice(req, res) {
    try {
      const existing = await Notice.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '通知不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(existing, scope)) {
        return res.status(403).json({ success: false, error: '无权删除该通知' });
      }
      const ok = await Notice.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '通知不存在' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: '删除通知失败' });
    }
  }
}

module.exports = NoticeController;
