const path = require('path');
const Announcement = require('../models/Announcement');
const Resource = require('../models/Resource');
const { resolveScope, filterByClassScope, canAccessClassRecord, canAccessOwnClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');

class AnnouncementController {
  /* ---------- 公告 ---------- */

  static async createAnnouncement(req, res) {
    try {
      const { title, content, is_pinned } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ success: false, error: '标题和内容必填' });
      }
      const scope = await resolveScope(req.user);
      // 审计修复：原实现把 is_pinned 丢弃 → 首页「置顶公告」永远为空
      const id = await Announcement.create({ title, content, creator_id: req.user.id, is_pinned: !!is_pinned });
      await stampClassId('announcements', id, scope.writeClassId);
      res.json({ success: true, id, message: '公告发布成功' });
    } catch (e) {
      console.error('公告发布失败:', e);
      res.status(500).json({ success: false, error: '公告发布失败' });
    }
  }

  static async listAnnouncements(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const announcements = filterByClassScope(await Announcement.getAll(), scope);
      res.json({ success: true, announcements });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取公告失败' });
    }
  }

  static async getAnnouncementDetail(req, res) {
    try {
      const item = await Announcement.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: '公告不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessClassRecord(item, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该公告' });
      }
      res.json({ success: true, announcement: item });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取公告详情失败' });
    }
  }

  /**
   * 编辑公告（P3-4）
   *
   * 谁能改：
   *  - 超管：全部
   *  - 发布者本人（区队长等有 PUBLISH_ANNOUNCEMENT 的角色）：自己发的
   *  - 其余人拒绝
   * 每次编辑都会追加一条修订快照，可查看历史、可回退。
   */
  static async updateAnnouncement(req, res) {
    try {
      const existing = await Announcement.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '公告不存在' });

      const isSuperAdmin = Number(req.user.role) >= 8;
      const isAuthor = Number(existing.creator_id) === Number(req.user.id);
      let canPublish = false;
      try {
        const { hasPermission } = require('../shared/permissions');
        canPublish = await hasPermission(req.user, 'PUBLISH_ANNOUNCEMENT');
      } catch { canPublish = isSuperAdmin; }
      if (!isSuperAdmin && !(isAuthor && canPublish)) {
        return res.status(403).json({ success: false, error: '只能修改自己发布的公告' });
      }

      const { title, content, is_pinned } = req.body || {};
      if (title !== undefined && !String(title).trim()) {
        return res.status(400).json({ success: false, error: '标题不能为空' });
      }
      if (content !== undefined && !String(content).trim()) {
        return res.status(400).json({ success: false, error: '内容不能为空' });
      }

      const patch = {};
      if (title !== undefined) patch.title = String(title).trim();
      if (content !== undefined) patch.content = String(content);
      if (is_pinned !== undefined) patch.is_pinned = !!is_pinned;

      const updated = await Announcement.update(req.params.id, patch, req.user.id);
      if (!updated) return res.status(404).json({ success: false, error: '公告不存在' });
      return res.json({ success: true, version: updated.version, message: `已保存（版本 v${updated.version}）` });
    } catch (e) {
      console.error('编辑公告失败:', e);
      return res.status(500).json({ success: false, error: '编辑公告失败' });
    }
  }

  /** 修订历史（列表不含正文，避免一次传回所有历史 HTML） */
  static async listAnnouncementRevisions(req, res) {
    try {
      const existing = await Announcement.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '公告不存在' });
      const revisions = await Announcement.listRevisions(req.params.id);
      return res.json({ success: true, revisions, currentVersion: revisions[0]?.version || 0 });
    } catch (e) {
      console.error('获取修订历史失败:', e);
      return res.status(500).json({ success: false, error: '获取修订历史失败' });
    }
  }

  /** 查看某个修订版本的完整内容 */
  static async getAnnouncementRevision(req, res) {
    try {
      const version = Number(req.params.version);
      if (!Number.isInteger(version) || version < 1) {
        return res.status(400).json({ success: false, error: '版本号不合法' });
      }
      const revision = await Announcement.getRevision(req.params.id, version);
      if (!revision) return res.status(404).json({ success: false, error: '该版本不存在' });
      return res.json({ success: true, revision });
    } catch (e) {
      console.error('获取修订版本失败:', e);
      return res.status(500).json({ success: false, error: '获取修订版本失败' });
    }
  }

  /** 回退到某个历史版本（生成新版本，历史不丢） */
  static async revertAnnouncement(req, res) {
    try {
      const existing = await Announcement.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '公告不存在' });

      const isSuperAdmin = Number(req.user.role) >= 8;
      const isAuthor = Number(existing.creator_id) === Number(req.user.id);
      let canPublish = false;
      try {
        const { hasPermission } = require('../shared/permissions');
        canPublish = await hasPermission(req.user, 'PUBLISH_ANNOUNCEMENT');
      } catch { canPublish = isSuperAdmin; }
      if (!isSuperAdmin && !(isAuthor && canPublish)) {
        return res.status(403).json({ success: false, error: '只能回退自己发布的公告' });
      }

      const version = Number(req.params.version);
      if (!Number.isInteger(version) || version < 1) {
        return res.status(400).json({ success: false, error: '版本号不合法' });
      }
      const result = await Announcement.revert(req.params.id, version, req.user.id);
      if (!result) return res.status(404).json({ success: false, error: '该版本不存在' });
      return res.json({
        success: true,
        version: result.version,
        revertedFrom: result.revertedFrom,
        message: `已回退到 v${version}（生成新版本 v${result.version}）`,
      });
    } catch (e) {
      console.error('回退公告失败:', e);
      return res.status(500).json({ success: false, error: '回退公告失败' });
    }
  }

  static async deleteAnnouncement(req, res) {
    try {
      const existing = await Announcement.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '公告不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(existing, scope)) {
        return res.status(403).json({ success: false, error: '无权删除该公告' });
      }
      const ok = await Announcement.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '公告不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除公告失败' });
    }
  }

  /* ---------- 资源共享 ---------- */

  static async createResource(req, res) {
    try {
      const { name, type, url, size, category, description } = req.body || {};
      if (!name || !url) {
        return res.status(400).json({ success: false, error: '资源名称和URL必填' });
      }
      const scope = await resolveScope(req.user);
      const id = await Resource.create({
        name, type: type || 'other', url, size, category, description,
        uploader_id: req.user.id
      });
      await stampClassId('resources', id, scope.writeClassId);
      res.json({ success: true, id, message: '资源上传成功' });
    } catch (e) {
      console.error('资源上传失败:', e);
      res.status(500).json({ success: false, error: '资源上传失败' });
    }
  }

  static async listResources(req, res) {
    try {
      const { category } = req.query;
      const scope = await resolveScope(req.user);
      const resources = filterByClassScope(await Resource.getAll(category), scope);
      res.json({ success: true, resources });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取资源失败' });
    }
  }

  static async uploadResource(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择文件' });
      }
      const file = req.file;
      const ext = path.extname(file.originalname).slice(1).toLowerCase() || 'file';
      const url = `/uploads/resources/${file.filename}`;

      // 同时创建资源记录
      const uploadScope = await resolveScope(req.user);
      const resourceId = await Resource.create({
        name: req.body.name || file.originalname,
        type: req.body.type || ext,
        url,
        size: file.size,
        uploader_id: req.user.id,
        category: req.body.category || '其他',
        description: req.body.description || '',
      });
      await stampClassId('resources', resourceId, uploadScope.writeClassId);

      res.json({
        success: true,
        url,
        filename: file.originalname,
        size: file.size,
        type: ext,
        id: resourceId,
      });
    } catch (e) {
      console.error('文件上传失败:', e);
      res.status(500).json({ success: false, error: '文件上传失败' });
    }
  }

  static async deleteResource(req, res) {
    try {
      const existing = await Resource.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '资源不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(existing, scope)) {
        return res.status(403).json({ success: false, error: '无权删除该资源' });
      }
      const ok = await Resource.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '资源不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除资源失败' });
    }
  }
}

module.exports = AnnouncementController;
