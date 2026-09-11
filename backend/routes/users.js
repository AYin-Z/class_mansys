const express = require('express');
const router = express.Router();
const db = require('../config/database');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../shared/permissions');
const { resolveScope } = require('../shared/scope');
const { AdminMembers } = require('../services/adminMembers');

/**
 * 用户资料接口（P0 加固）
 *
 * 历史问题：本文件早期只按「role>=1 即管理员」判断，导致任一班干部可以
 *   ① GET /api/users 拿到全库手机号/邮箱；② PUT 改任意人的邮箱/手机号 →
 *      再用 /api/auth/email-code-login 收码登录，直接接管超管账号；③ DELETE 删任意账号。
 *
 * 现在：
 *   - 列表：按作用域过滤，且只返回非敏感字段（不返回 phone/email）；
 *   - 改资料：本人可改自己的联系方式；改他人必须 MANAGE_MEMBERS，且**不允许改邮箱/手机号**
 *     （防止「改别人邮箱 → 验证码登录」的账号接管链）；
 *   - 删除：必须 MANAGE_MEMBERS，复用「无历史数据才可删」的规则，禁止删自己与超管。
 */

// 名单（按作用域，供加积分/擂台等页面选人）
router.get('/', authenticateToken, requirePermission('VIEW_ROSTER'), async (req, res) => {
  try {
    const scope = await resolveScope(req.user);
    const where = ["u.member_type <> 'left'"];
    const params = [];
    if (Array.isArray(scope.classIds)) {
      if (!scope.classIds.length) return res.json({ success: true, users: [] });
      where.push('u.class_id IN (' + scope.classIds.map(() => '?').join(',') + ')');
      params.push(...scope.classIds);
    }
    const [rows] = await db.query(
      'SELECT u.id, u.name, u.nickName, u.student_id, u.class_id, u.role, u.duty_note, u.avatarUrl, u.gender ' +
      'FROM users u WHERE ' + where.join(' AND ') + ' ORDER BY u.class_id, u.student_id LIMIT 500',
      params
    );
    return res.json({ success: true, users: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

// 单个用户
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const isSelf = Number(req.user.id) === Number(req.params.id);
    if (!isSelf) {
      // 看他人资料：需要名册权限，且必须在本区队作用域内
      const { hasPermission } = require('../shared/permissions');
      if (!hasPermission(req.user, 'VIEW_ROSTER')) {
        return res.status(403).json({ success: false, error: '权限不足' });
      }
      const scope = await resolveScope(req.user);
      const [[target]] = await db.query('SELECT class_id FROM users WHERE id = ?', [req.params.id]);
      if (!target) return res.status(404).json({ success: false, error: '用户不存在' });
      if (Array.isArray(scope.classIds) && scope.classIds.indexOf(String(target.class_id)) === -1) {
        return res.status(403).json({ success: false, error: '无权查看其他区队成员' });
      }
    }
    const user = await User.findPublicById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

// 更新：本人可改联系方式；改他人仅限非敏感字段且需 MANAGE_MEMBERS
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const isSelf = Number(req.user.id) === Number(req.params.id);
    const SELF_FIELDS = ['name', 'nickName', 'phone', 'email', 'avatarUrl'];
    const OTHER_FIELDS = ['name', 'nickName', 'avatarUrl'];
    let allowed = SELF_FIELDS;

    if (!isSelf) {
      const { hasPermission } = require('../shared/permissions');
      if (!hasPermission(req.user, 'MANAGE_MEMBERS')) {
        return res.status(403).json({ success: false, error: '权限不足：只能修改本人资料' });
      }
      // 关键：不允许改他人的邮箱/手机号（验证码登录会因此被接管）
      allowed = OTHER_FIELDS;
    }

    const body = req.body || {};
    const picked = {};
    for (const k of allowed) if (body[k] !== undefined) picked[k] = body[k];
    const hasField = Object.keys(picked).length > 0;
    if (!hasField) {
      return res.status(400).json({
        success: false,
        error: isSelf ? '没有可更新的字段' : '只能修改姓名/昵称/头像；联系方式请由本人在设置里修改'
      });
    }
    const success = await User.update(req.params.id, picked);
    if (!success) return res.status(404).json({ success: false, error: '用户不存在' });
    const user = await User.findPublicById(req.params.id);
    return res.json({ success: true, message: '更新成功', user });
  } catch (error) {
    return res.status(500).json({ success: false, error: '更新失败' });
  }
});

// 删除：仅 MANAGE_MEMBERS，且有历史数据不允许物理删除（与超管后台一致）
router.delete('/:id', authenticateToken, requirePermission('MANAGE_MEMBERS'), async (req, res) => {
  try {
    if (Number(req.user.id) === Number(req.params.id)) {
      return res.status(400).json({ success: false, error: '不能删除自己' });
    }
    const result = await AdminMembers.remove(Number(req.params.id));
    return res.json({ success: true, message: '删除成功', data: result });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ success: false, error: error.message || '删除失败' });
  }
});

module.exports = router;
