const ClassInfo = require('../models/ClassInfo');

const { isAdmin } = require('../shared/constants');

class ClassController {
  static async list(req, res) {
    try {
      const classes = await ClassInfo.getAll();
      res.json({ success: true, classes });
    } catch (e) {
      console.error('获取班级失败:', e);
      res.status(500).json({ success: false, error: '获取班级列表失败' });
    }
  }

  static async create(req, res) {
    try {
      if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '需要管理员权限' });
      const { id, name } = req.body || {};
      if (!id || !name) return res.status(400).json({ success: false, error: '班级 id 和 name 必填' });
      await ClassInfo.create({ id, name });
      res.json({ success: true, id });
    } catch (e) {
      console.error('创建班级失败:', e);
      res.status(500).json({ success: false, error: e.code === 'ER_DUP_ENTRY' ? '班级已存在' : '创建失败' });
    }
  }
}

module.exports = ClassController;
