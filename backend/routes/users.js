const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { isAdmin } = require('../shared/constants');

// 获取所有用户
router.get('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

// 获取单个用户
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

// 更新用户信息
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // 只能更新自己的信息，管理员可以更新所有
    if (req.user.id != req.params.id && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }
    
    const success = await User.update(req.params.id, req.body);
    if (success) {
      res.json({ success: true, message: '更新成功' });
    } else {
      res.status(404).json({ success: false, error: '用户不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

// 删除用户
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const success = await User.delete(req.params.id);
    if (success) {
      res.json({ success: true, message: '删除成功' });
    } else {
      res.status(404).json({ success: false, error: '用户不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

module.exports = router;