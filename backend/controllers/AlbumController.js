const Album = require('../models/Album');
const Photo = require('../models/Photo');
const mediaService = require('../services/mediaService');

const { isAdmin } = require('../shared/constants');
const { resolveScope, filterByClassScope, canAccessClassRecord, canAccessOwnClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');
const { parseCursorPaging, decodeCursor } = require('../shared/paging');

class AlbumController {
  /* ---------- 相册 ---------- */

  static async createAlbum(req, res) {
    try {
      const { name, description, permission } = req.body || {};
      if (!name) return res.status(400).json({ success: false, error: '相册名称必填' });
      const scope = await resolveScope(req.user);
      const id = await Album.create({
        name,
        description,
        creator_id: req.user.id,
        permission: typeof permission === 'number' ? permission : 0
      });
      await stampClassId('albums', id, scope.writeClassId);
      res.json({ success: true, id, message: '相册创建成功' });
    } catch (e) {
      console.error('创建相册失败:', e);
      res.status(500).json({ success: false, error: '创建相册失败' });
    }
  }

  static async listAlbums(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const albums = filterByClassScope(await Album.getAll(), scope);
      res.json({ success: true, albums });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取相册失败' });
    }
  }

  static async getAlbumDetail(req, res) {
    try {
      const album = await Album.findById(req.params.id);
      if (!album) return res.status(404).json({ success: false, error: '相册不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessClassRecord(album, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该相册' });
      }
      // 待审核照片对"有审核权的人"可见（不只是 role>=8）
      const includePending = await mediaService.canApprovePhotos(req.user);

      // 相册照片流分页（P1-3）：只有带了 limit/cursor 才走游标分页；
      // 不带参数 = 旧客户端，行为与分页前完全一致（全量 + 原字段名）。
      const paging = parseCursorPaging(req.query);
      if (!paging.paged) {
        const photos = await Photo.getByAlbum(req.params.id, includePending);
        return res.json({ success: true, album, photos });
      }

      const cursor = decodeCursor(paging.cursor); // 非法游标按"第一页"处理，不报错
      const { photos, hasMore, nextCursor } = await Photo.getAlbumPage(req.params.id, {
        includePending,
        limit: paging.limit,
        cursor
      });
      // nextCursor / hasMore / limit 都是**追加**字段，photos / album 原样保留
      return res.json({ success: true, album, photos, limit: paging.limit, hasMore, nextCursor });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取相册详情失败' });
    }
  }

  static async deleteAlbum(req, res) {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      const existing = await Album.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: '相册不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(existing, scope)) {
        return res.status(403).json({ success: false, error: '无权删除该相册' });
      }
      // 先取出照片列表用于清理磁盘文件，再删记录
      const photos = await Photo.getByAlbum(req.params.id, true).catch(() => []);
      const ok = await Album.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '相册不存在' });
      for (const p of photos) {
        await mediaService.removeByUrl(p.url).catch(() => {});
      }
      res.json({ success: true, removedFiles: photos.length });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除相册失败' });
    }
  }

  /* ---------- 照片 ---------- */

  static async uploadPhotos(req, res) {
    try {
      const { album_id, urls, description } = req.body || {};
      if (!album_id || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ success: false, error: '相册ID和图片URL列表必填' });
      }
      const album = await Album.findById(album_id);
      if (!album) return res.status(404).json({ success: false, error: '相册不存在' });
      const uploadScope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(album, uploadScope)) {
        return res.status(403).json({ success: false, error: '无权向该相册上传' });
      }

      const autoApprove = (await mediaService.canApprovePhotos(req.user))
        || Number(album.creator_id) === Number(req.user.id);
      const ids = [];
      for (const url of urls) {
        const id = await Photo.create({
          album_id,
          url,
          description,
          uploader_id: req.user.id,
          auto_approve: autoApprove
        });
        ids.push(id);
      }

      res.json({
        success: true,
        ids,
        autoApproved: autoApprove,
        message: autoApprove ? '上传成功' : '上传成功，等待审核'
      });
    } catch (e) {
      console.error('上传照片失败:', e);
      res.status(500).json({ success: false, error: '上传照片失败' });
    }
  }

  static async uploadPhotoFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择图片' });
      }
      const albumId = parseInt(req.body.album_id, 10);
      const safeRemove = async () => {
        try { await mediaService.removeByUrl(mediaService.absPathToUrl(req.file.path)); } catch { /* ignore */ }
      };
      if (!albumId) {
        await safeRemove();
        return res.status(400).json({ success: false, error: '缺少相册 ID' });
      }

      const album = await Album.findById(albumId);
      if (!album) {
        await safeRemove();
        return res.status(404).json({ success: false, error: '相册不存在' });
      }
      const fileScope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(album, fileScope)) {
        await safeRemove();
        return res.status(403).json({ success: false, error: '无权向该相册上传' });
      }

      // 生成 thumb(480) / medium(1440) 派生图：网格与查看器不再加载原图
      const info = await mediaService.describe(req.file, {
        kind: 'album',
        ownerId: req.user.id,
        classId: fileScope.writeClassId || null,
      });
      const autoApprove = (await mediaService.canApprovePhotos(req.user))
        || Number(album.creator_id) === Number(req.user.id);

      const photoId = await Photo.create({
        album_id: albumId,
        url: info.url,
        thumb_url: info.thumbUrl,
        medium_url: info.mediumUrl,
        width: info.width,
        height: info.height,
        size: info.size,
        mime: info.mime,
        description: req.body.description || '',
        uploader_id: req.user.id,
        auto_approve: autoApprove,
      });

      res.json({
        success: true,
        url: info.url,
        thumbUrl: info.thumbUrl,
        mediumUrl: info.mediumUrl,
        filename: info.filename,
        size: info.size,
        width: info.width,
        height: info.height,
        id: photoId,
        autoApproved: autoApprove,
        message: autoApprove ? '上传成功' : '上传成功，等待审核',
      });
    } catch (e) {
      console.error('图片上传失败:', e);
      res.status(500).json({ success: false, error: '图片上传失败' });
    }
  }

  static async getPendingPhotos(req, res) {
    try {
      // 路由已要求 APPROVE_PHOTO；这里保持同一口径（此前卡 role>=8，
      // 导致"矩阵里配了审核权但 role<8"的干部拿到 403，审核功能形同虚设）
      if (!(await mediaService.canApprovePhotos(req.user))) {
        return res.status(403).json({ success: false, error: '需要照片审核权限' });
      }
      const photos = await Photo.getPendingPhotos();
      res.json({ success: true, photos });
    } catch (e) {
      res.status(500).json({ success: false, error: '获取待审核照片失败' });
    }
  }

  static async approvePhoto(req, res) {
    try {
      if (!(await mediaService.canApprovePhotos(req.user))) {
        return res.status(403).json({ success: false, error: '需要照片审核权限' });
      }
      const ok = await Photo.approve(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ success: false, error: '照片不存在' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '审核照片失败' });
    }
  }

  /**
   * 删除照片
   *
   * 权限（2026-09 放宽到"本人也能删自己的"）：
   *  - 有 APPROVE_PHOTO：可删任意照片（待审核 = 驳回）
   *  - 相册创建者：可删本相册任意照片
   *  - 上传者本人：可删自己上传的照片
   * 删除时一并清理磁盘文件与派生图，避免留下孤儿文件。
   */
  static async rejectPhoto(req, res) {
    try {
      const photo = await Photo.findById(req.params.id);
      if (!photo) return res.status(404).json({ success: false, error: '照片不存在' });

      const album = await Album.findById(photo.album_id);
      const isOwner = Number(photo.uploader_id) === Number(req.user.id);
      const isAlbumCreator = album && Number(album.creator_id) === Number(req.user.id);
      const canApprove = await mediaService.canApprovePhotos(req.user);

      if (!isOwner && !isAlbumCreator && !canApprove && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '无权删除该照片' });
      }

      const ok = await Photo.delete(req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '照片不存在' });

      // 文件删除失败不影响接口成功（最多留下孤儿文件，可由清理脚本回收）
      await mediaService.removeByUrl(photo.url).catch(() => {});
      return res.json({ success: true });
    } catch (e) {
      console.error('删除照片失败:', e);
      res.status(500).json({ success: false, error: '删除照片失败' });
    }
  }
}

module.exports = AlbumController;
