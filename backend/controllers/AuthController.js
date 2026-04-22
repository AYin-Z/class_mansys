const jwt = require('jsonwebtoken');
const User = require('../models/User');
const axios = require('axios');

class AuthController {
  static async login(req, res) {
    const { code, userInfo } = req.body;

    try {
      // 调用微信API获取openid
      const response = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: process.env.APPID,
          secret: process.env.APPSECRET,
          js_code: code,
          grant_type: 'authorization_code'
        }
      });

      const { openid, session_key } = response.data;

      // 查找用户
      let user = await User.findByOpenid(openid);

      if (!user) {
        // 新用户，创建用户记录
        user = await User.create({
          openid,
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          gender: userInfo.gender || 0,
          student_id: userInfo.student_id || '',
          name: userInfo.name || userInfo.nickName,
          class_id: userInfo.class_id || '',
          role: userInfo.role || 0,
          phone: userInfo.phone || '',
          email: userInfo.email || ''
        });
        user = await User.findByOpenid(openid);
      } else {
        // 更新用户信息
        await User.update(user.id, {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          gender: userInfo.gender || 0
        });
      }

      // 生成JWT令牌
      const token = jwt.sign(
        {
          id: user.id,
          openid: user.openid,
          role: user.role,
          isAdmin: user.role > 0
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          class_id: user.class_id,
          avatarUrl: user.avatarUrl
        }
      });
    } catch (error) {
      console.error('登录失败:', error);
      res.status(500).json({ success: false, error: '登录失败' });
    }
  }

  /**
   * CloudBase UID 登录 - 供 H5/Web/非微信端使用
   * 通过 CloudBase 认证后的 UID 在后端创建/查找对应用户
   */
  static async cloudBaseLogin(req, res) {
    const { uid, phone, email, nickName } = req.body;

    if (!uid) {
      return res.status(400).json({ success: false, error: '缺少 uid 参数' });
    }

    try {
      // 用 CloudBase UID 作为 openid 来关联用户
      const cloudbaseOpenid = `cloudbase_${uid}`;
      let user = await User.findByOpenid(cloudbaseOpenid);

      if (!user) {
        // 新用户，创建用户记录
        user = await User.create({
          openid: cloudbaseOpenid,
          nickName: nickName || '新用户',
          avatarUrl: '',
          gender: 0,
          student_id: '',
          name: nickName || '新用户',
          class_id: '',
          role: 0,
          phone: phone || '',
          email: email || ''
        });
        user = await User.findByOpenid(cloudbaseOpenid);
      } else {
        // 更新可变信息
        const updates = {};
        if (nickName) updates.nickName = nickName;
        if (phone && !user.phone) updates.phone = phone;
        if (email && !user.email) updates.email = email;
        if (Object.keys(updates).length > 0) {
          await User.update(user.id, updates);
          user = await User.findById(user.id);
        }
      }

      // 生成JWT令牌
      const token = jwt.sign(
        {
          id: user.id,
          openid: user.openid,
          role: user.role,
          isAdmin: user.role > 0
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          nickName: user.nickName,
          student_id: user.student_id,
          role: user.role,
          class_id: user.class_id,
          avatarUrl: user.avatarUrl,
          phone: user.phone,
          email: user.email
        }
      });
    } catch (error) {
      console.error('CloudBase 登录失败:', error);
      res.status(500).json({ success: false, error: '登录失败' });
    }
  }

  /**
   * 注册：写入用户 + 直接签发 JWT，前端无需再走一次 login
   *
   * 入参（兼容老结构 { openid, userData } 与新结构 { ...userData, openid }）：
   *   - openid?:        任意客户端生成的唯一标识（手动注册可传 manual_<studentId>_<ts>）
   *   - student_id*     学号（手动注册唯一识别）
   *   - name*           真实姓名
   *   - phone, email, gender, class_id, nickName, avatarUrl
   *   - role:           可以是 INT (0-8) 或中文角色名（区队长/生活副区/...）
   *   - politicalStatus, classPosition, schoolPosition  目前不入库，预留扩展
   *
   * 返回：{ success, token, user }
   */
  static async register(req, res) {
    try {
      const body = req.body || {};
      // 兼容旧调用 { openid, userData }
      const data = body.userData ? { openid: body.openid, ...body.userData } : { ...body };

      const studentId = String(data.student_id || data.studentId || '').trim();
      const name = String(data.name || '').trim();
      const phone = String(data.phone || '').trim();
      const email = String(data.email || '').trim();
      const classId = String(data.class_id || data.classId || '').trim();

      // 基础必填
      if (!studentId || !name) {
        return res.status(400).json({ success: false, error: '学号与姓名不能为空' });
      }
      // 字段有效性校验（与前端一致，防御性再做一次）
      const STUDENT_ID_RE = /^[A-Za-z0-9]{4,20}$/;
      const NAME_RE       = /^[\u4e00-\u9fa5A-Za-z·•\s]{2,20}$/;
      const PHONE_RE      = /^1[3-9]\d{9}$/;
      const EMAIL_RE      = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!STUDENT_ID_RE.test(studentId)) {
        return res.status(400).json({ success: false, error: '学号应为 4-20 位字母或数字' });
      }
      if (!NAME_RE.test(name)) {
        return res.status(400).json({ success: false, error: '姓名格式不正确' });
      }
      if (phone && !PHONE_RE.test(phone)) {
        return res.status(400).json({ success: false, error: '手机号码格式不正确' });
      }
      if (email && !EMAIL_RE.test(email)) {
        return res.status(400).json({ success: false, error: '邮箱格式不正确' });
      }
      if (classId) {
        try {
          const ClassInfo = require('../models/ClassInfo');
          const cls = await ClassInfo.findById(classId);
          if (!cls) {
            return res.status(400).json({ success: false, error: '所选班级不存在' });
          }
        } catch (_) { /* 班级表异常不阻断注册，由后续逻辑兜底 */ }
      }

      // 中文角色名 → INT
      const ROLE_MAP = {
        '学员': 0, '区队长': 1, '生活副区': 2, '学习副区': 3,
        '心理副区': 4, '团支书': 5, '组织委员': 6, '宣传委员': 7,
        '超级管理员': 8
      };
      let roleId = 0;
      if (typeof data.role === 'number') roleId = data.role;
      else if (typeof data.role === 'string') roleId = ROLE_MAP[data.role] ?? 0;
      else if (data.adminRole) roleId = ROLE_MAP[data.adminRole] ?? 0;

      // openid 兜底
      const openid = data.openid || `manual_${studentId}_${Date.now()}`;

      // 学号唯一性检查
      const existingByStudentId = await User.findByStudentId(studentId);
      if (existingByStudentId) {
        // 已有同学号用户，直接复用并签发 token（让重复注册等价于登录）
        const token = jwt.sign(
          {
            id: existingByStudentId.id,
            openid: existingByStudentId.openid,
            role: existingByStudentId.role,
            isAdmin: existingByStudentId.role > 0
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        return res.json({
          success: true,
          token,
          reused: true,
          user: AuthController._publicUser(existingByStudentId)
        });
      }

      const existingByOpenid = await User.findByOpenid(openid);
      if (existingByOpenid) {
        const token = jwt.sign(
          {
            id: existingByOpenid.id,
            openid: existingByOpenid.openid,
            role: existingByOpenid.role,
            isAdmin: existingByOpenid.role > 0
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        return res.json({
          success: true,
          token,
          reused: true,
          user: AuthController._publicUser(existingByOpenid)
        });
      }

      const userId = await User.create({
        openid,
        nickName: data.nickName || name,
        avatarUrl: data.avatarUrl || '',
        gender: typeof data.gender === 'number' ? data.gender : 0,
        student_id: studentId,
        name,
        class_id: classId,
        role: roleId,
        phone,
        email
      });
      const user = await User.findById(userId);

      const token = jwt.sign(
        {
          id: user.id,
          openid: user.openid,
          role: user.role,
          isAdmin: user.role > 0
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        token,
        user: AuthController._publicUser(user)
      });
    } catch (error) {
      console.error('注册失败:', error);
      res.status(500).json({ success: false, error: '注册失败：' + (error.message || '未知错误') });
    }
  }

  /** 把 DB user 转成对外 user 对象（去敏感字段） */
  static _publicUser(u) {
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      nickName: u.nickName,
      student_id: u.student_id,
      class_id: u.class_id,
      role: u.role,
      phone: u.phone,
      email: u.email,
      avatarUrl: u.avatarUrl,
      gender: u.gender
    };
  }

  static async refreshToken(req, res) {
    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, error: '用户不存在' });
      }

      const newToken = jwt.sign(
        {
          id: user.id,
          openid: user.openid,
          role: user.role,
          isAdmin: user.role > 0
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({ success: true, token: newToken });
    } catch (error) {
      res.status(401).json({ success: false, error: '无效的刷新令牌' });
    }
  }

  static async logout(req, res) {
    // 客户端处理登出，服务端无需特殊处理
    res.json({ success: true, message: '登出成功' });
  }

  /** 按学号查询用户（用于积分加扣分等场景） */
  static async findByStudent(req, res) {
    try {
      const { student_id } = req.body || {};
      if (!student_id) return res.status(400).json({ success: false, error: 'student_id 必填' });
      const user = await User.findByStudentId(student_id);
      if (!user) return res.status(404).json({ success: false, error: '未找到该学号' });
      res.json({ success: true, user: AuthController._publicUser(user) });
    } catch (e) {
      res.status(500).json({ success: false, error: '查询失败' });
    }
  }

  static async getUserInfo(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: '用户不存在' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          student_id: user.student_id,
          class_id: user.class_id,
          role: user.role,
          phone: user.phone,
          email: user.email,
          avatarUrl: user.avatarUrl,
          nickName: user.nickName
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取用户信息失败' });
    }
  }
}

module.exports = AuthController;