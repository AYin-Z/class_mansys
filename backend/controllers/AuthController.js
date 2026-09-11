const User = require('../models/User');
const axios = require('axios');
const { ROLES } = require('../shared/constants');
const authService = require('../services/authService');

// P2：验证码/令牌/密码等基础设施已下沉到 services/authService.js
const {
  PHONE_RE,
  EMAIL_RE,
  otpConfig,
  generateCode,
  storeCode,
  verifyCode,
  clearCode,
  canSendCode,
  normalizeTarget,
  fallbackStudentId,
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword
} = authService;
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

      const { openid } = response.data;

      // 检查微信API是否返回错误
      if (response.data.errcode) {
        return res.status(400).json({ success: false, error: '微信登录失败: ' + (response.data.errmsg || '未知错误') });
      }

      // 查找用户
      let user = await User.findByOpenid(openid);

      if (!user) {
        // 新用户，创建用户记录（兼容无 userInfo 场景）
        const info = userInfo || {};
        user = await User.create({
          openid,
          nickName: info.nickName || '微信用户',
          avatarUrl: info.avatarUrl || '',
          gender: info.gender || 0,
          student_id: info.student_id || '',
          name: info.name || info.nickName || '微信用户',
          class_id: info.class_id || '',
          role: ROLES.STUDENT,
          phone: info.phone || '',
          email: info.email || ''
        });
        user = await User.findByOpenid(openid);
      } else {
        // 更新用户信息
        const info = userInfo || {};
        await User.update(user.id, {
          nickName: info.nickName,
          avatarUrl: info.avatarUrl,
          gender: info.gender || 0
        });
      }

      // 生成JWT令牌
      const token = signToken(user);

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
    const { uid, phone, email, nickName, cloudbaseToken } = req.body;

    if (!uid || !cloudbaseToken) {
      return res.status(400).json({ success: false, error: '缺少 CloudBase 身份凭证' });
    }
    if (process.env.NODE_ENV === 'production' && !process.env.CLOUDBASE_AUTH_VERIFY_URL) {
      return res.status(503).json({ success: false, error: 'CloudBase 登录校验未配置' });
    }

    try {
      if (process.env.CLOUDBASE_AUTH_VERIFY_URL) {
        const verifyRes = await axios.post(process.env.CLOUDBASE_AUTH_VERIFY_URL, { uid, token: cloudbaseToken }, { timeout: 5000 });
        if (!verifyRes.data?.success || verifyRes.data?.uid !== uid) {
          return res.status(401).json({ success: false, error: 'CloudBase 身份校验失败' });
        }
      }
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
          student_id: fallbackStudentId('cb', uid),
          name: nickName || '新用户',
          class_id: '',
          role: ROLES.STUDENT,
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

      const token = signToken(user);

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
   */
  static async register(req, res) {
    try {
      const body = req.body || {};
      const data = body.userData ? { openid: body.openid, ...body.userData } : { ...body };

      const studentId = String(data.student_id || data.studentId || '').trim();
      const name = String(data.name || '').trim();
      const phone = String(data.phone || '').trim();
      const email = String(data.email || '').trim();
      const classId = String(data.class_id || data.classId || '').trim();

      if (!studentId || !name) {
        return res.status(400).json({ success: false, error: '学号与姓名不能为空' });
      }
      const STUDENT_ID_RE = /^[A-Za-z0-9]{4,20}$/;
      const NAME_RE       = /^[\u4e00-\u9fa5A-Za-z·•\s]{2,20}$/;
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

      const openid = data.openid || `manual_${studentId}_${Date.now()}`;

      const existingByStudentId = await User.findByStudentId(studentId);
      if (existingByStudentId) {
        return res.status(409).json({ success: false, error: '该学号已注册，请直接登录或联系管理员' });
      }

      const existingByOpenid = await User.findByOpenid(openid);
      if (existingByOpenid) {
        return res.status(409).json({ success: false, error: '该身份已注册，请直接登录' });
      }

      const userId = await User.create({
        openid,
        nickName: data.nickName || name,
        avatarUrl: data.avatarUrl || '',
        gender: typeof data.gender === 'number' ? data.gender : 0,
        student_id: studentId,
        name,
        class_id: classId,
        role: ROLES.STUDENT,
        phone,
        email
      });
      const user = await User.findById(userId);

      const token = signToken(user);

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
      const decoded = verifyToken(refreshToken);
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, error: '用户不存在' });
      }

      const newToken = signToken(user);
      res.json({ success: true, token: newToken });
    } catch (error) {
      res.status(401).json({ success: false, error: '无效的刷新令牌' });
    }
  }

  static async logout(req, res) {
    res.json({ success: true, message: '登出成功' });
  }

  /** 按学号查询用户 */
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
        },
        // 权限快照：前端据此显示/隐藏入口（服务端仍会再校验一次）
        permissions: require('../shared/permissions').permissionsFor(user.role)
      });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取用户信息失败' });
    }
  }

  /**
   * 学号+密码登录（主要登录方式）
   */
  static async loginWithPassword(req, res) {
    try {
      const { student_id, password } = req.body;
      if (!student_id || !password) {
        return res.status(400).json({ success: false, error: '学号和密码不能为空' });
      }

      const user = await User.findByStudentId(student_id);
      if (!user) {
        return res.status(401).json({ success: false, error: '学号不存在' });
      }

      if (!user.password_hash) {
        return res.status(401).json({ success: false, error: '该账号未设置密码，请使用其他方式登录或设置密码' });
      }

      const valid = await verifyPassword(user, password);
      if (!valid) {
        return res.status(401).json({ success: false, error: '密码错误' });
      }

      const token = signToken(user);
      res.json({ success: true, token, user: AuthController._publicUser(user) });
    } catch (error) {
      console.error('学号密码登录失败:', error);
      res.status(500).json({ success: false, error: '登录失败' });
    }
  }

  /**
   * 手机号+密码登录
   */
  static async loginWithPhone(req, res) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ success: false, error: '手机号和密码不能为空' });
      }

      const user = await User.findByPhone(phone);
      if (!user) {
        return res.status(401).json({ success: false, error: '该手机号未注册' });
      }

      if (!user.password_hash) {
        return res.status(401).json({ success: false, error: '该账号未设置密码' });
      }

      const valid = await verifyPassword(user, password);
      if (!valid) {
        return res.status(401).json({ success: false, error: '密码错误' });
      }

      const token = signToken(user);
      res.json({ success: true, token, user: AuthController._publicUser(user) });
    } catch (error) {
      console.error('手机号登录失败:', error);
      res.status(500).json({ success: false, error: '登录失败' });
    }
  }

  /**
   * 邮箱+密码登录
   */
  static async loginWithEmail(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: '邮箱和密码不能为空' });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, error: '该邮箱未注册' });
      }

      if (!user.password_hash) {
        return res.status(401).json({ success: false, error: '该账号未设置密码' });
      }

      const valid = await verifyPassword(user, password);
      if (!valid) {
        return res.status(401).json({ success: false, error: '密码错误' });
      }

      const token = signToken(user);
      res.json({ success: true, token, user: AuthController._publicUser(user) });
    } catch (error) {
      console.error('邮箱登录失败:', error);
      res.status(500).json({ success: false, error: '登录失败' });
    }
  }

  /**
   * 发送验证码（手机号/邮箱）
   * 开发环境直接返回验证码
   */
  static async sendCode(req, res) {
    try {
      const normalized = normalizeTarget(req.body || {});
      if (normalized.error) {
        return res.status(400).json({ success: false, error: normalized.error });
      }
      const { target } = normalized;
      if (!canSendCode(target)) {
        return res.status(429).json({ success: false, error: '验证码发送过于频繁，请稍后再试' });
      }

      const { provider: OTP_PROVIDER, debugConsole: OTP_DEBUG_CONSOLE } = otpConfig();
      const code = generateCode();
      storeCode(target, code);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] 验证码 [${code}] 已发送至 ${target}`);
        return res.json({ success: true, code, message: '验证码已发送' });
      }
      // 邮箱验证码：通过已配置的 SMTP 真实发送（不再向客户端回显）
      if (normalized.type === 'email') {
        const mailer = require('../services/mailer');
        if (!mailer.isConfigured()) {
          if (OTP_DEBUG_CONSOLE) {
            console.log(`[PROD-DEBUG] 验证码 [${code}] 目标 ${target}`);
            return res.json({ success: true, message: '验证码已发送（DEBUG 模式，仅打印到服务端日志）' });
          }
          return res.status(503).json({ success: false, error: '邮件服务未配置，无法发送验证码' });
        }
        try {
          await mailer.sendMail({
            to: target,
            subject: '[区队管理系统] 登录验证码',
            text: '你的验证码是 ' + code + '，5 分钟内有效。如非本人操作请忽略本邮件。',
            html: '<p>你的验证码是 <b style="font-size:18px">' + code + '</b>，5 分钟内有效。</p><p style="color:#888">如非本人操作请忽略本邮件。</p>'
          });
          return res.json({ success: true, message: '验证码已发送至邮箱' });
        } catch (e) {
          console.error('验证码邮件发送失败:', e.message);
          return res.status(502).json({ success: false, error: '验证码发送失败，请稍后再试' });
        }
      }

      // 手机验证码：需要短信服务商（未接入时明确失败，避免"假装成功"）
      const smsConfigured = OTP_PROVIDER === 'sms' || OTP_PROVIDER === 'webhook';
      if (!smsConfigured) {
        if (OTP_DEBUG_CONSOLE) {
          console.log(`[PROD-DEBUG] 验证码 [${code}] 目标 ${target}`);
          return res.json({ success: true, message: '验证码已发送（DEBUG 模式，仅打印到服务端日志）' });
        }
        return res.status(503).json({ success: false, error: '短信服务未配置，无法发送验证码' });
      }
      // TODO: 接入短信服务商（sms/webhook）
      console.log(`[OTP] 待接入 ${OTP_PROVIDER} 发送验证码至 ${target}`);
      res.json({ success: true, message: '验证码已发送' });
    } catch (error) {
      console.error('发送验证码失败:', error);
      res.status(500).json({ success: false, error: '发送验证码失败' });
    }
  }

  /**
   * 手机号+验证码注册/登录
   */
  static async phoneCodeLogin(req, res) {
    try {
      const { code, name, student_id } = req.body;
      const normalized = normalizeTarget({ phone: req.body.phone });
      if (normalized.error || !code) {
        return res.status(400).json({ success: false, error: '手机号和验证码不能为空' });
      }
      const phone = normalized.target;

      if (!verifyCode(phone, code)) {
        return res.status(400).json({ success: false, error: '验证码错误或已过期' });
      }
      clearCode(phone);

      let user = await User.findByPhone(phone);
      if (user) {
        const token = signToken(user);
        return res.json({ success: true, token, user: AuthController._publicUser(user) });
      }

      const openid = `phone_${phone}_${Date.now()}`;
      const userId = await User.create({
        openid,
        nickName: name || phone,
        avatarUrl: '',
        gender: 0,
        student_id: student_id || fallbackStudentId('phone', phone),
        name: name || phone,
        class_id: '',
        role: 0,
        phone,
        email: ''
      });
      await User.verifyPhone(userId);
      user = await User.findById(userId);

      const token = signToken(user);
      res.json({ success: true, token, user: AuthController._publicUser(user) });
    } catch (error) {
      console.error('手机号验证码登录失败:', error);
      res.status(500).json({ success: false, error: '登录失败' });
    }
  }

  /**
   * 邮箱+验证码登录
   */
  static async emailCodeLogin(req, res) {
    try {
      const { code } = req.body;
      const normalized = normalizeTarget({ email: req.body.email });
      if (normalized.error || !code) {
        return res.status(400).json({ success: false, error: '邮箱和验证码不能为空' });
      }
      const email = normalized.target;

      if (!verifyCode(email, code)) {
        return res.status(400).json({ success: false, error: '验证码错误或已过期' });
      }
      clearCode(email);

      let user = await User.findByEmail(email);
      if (!user) {
        const openid = `email_${email}_${Date.now()}`;
        const userId = await User.create({
          openid,
          nickName: email,
          avatarUrl: '',
          gender: 0,
          student_id: fallbackStudentId('email', email),
          name: email,
          class_id: '',
          role: 0,
          phone: '',
          email
        });
        user = await User.findById(userId);
      }

      const token = signToken(user);
      res.json({ success: true, token, user: AuthController._publicUser(user) });
    } catch (error) {
      console.error('邮箱验证码登录失败:', error);
      res.status(500).json({ success: false, error: '登录失败' });
    }
  }

  /**
   * 设置/重置密码
   */
  static async setPassword(req, res) {
    try {
      const { phone, email, code, password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, error: '密码至少 6 位' });
      }
      if (!code) {
        return res.status(400).json({ success: false, error: '验证码不能为空' });
      }
      const normalized = normalizeTarget({ phone, email });
      if (normalized.error) {
        return res.status(400).json({ success: false, error: normalized.error });
      }
      if (!verifyCode(normalized.target, code)) {
        return res.status(400).json({ success: false, error: '验证码错误或已过期' });
      }
      let user = null;
      if (normalized.type === 'phone') user = await User.findByPhone(normalized.target);
      else user = await User.findByEmail(normalized.target);

      if (!user) {
        return res.status(404).json({ success: false, error: '用户不存在' });
      }

      clearCode(normalized.target);
      const hash = await hashPassword(password);
      await User.updatePassword(user.id, hash);

      const token = signToken(user);
      res.json({ success: true, token, user: AuthController._publicUser(user) });
    } catch (error) {
      console.error('设置密码失败:', error);
      res.status(500).json({ success: false, error: '设置密码失败' });
    }
  }

  /** JWT 签名辅助 */
  static async changePassword(req, res) {
    try {
      const oldPassword = req.body.oldPassword || req.body.old_password;
      const newPassword = req.body.newPassword || req.body.new_password;
      if (!oldPassword) return res.status(400).json({ success: false, error: '请输入旧密码' });
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: '新密码至少 6 位' });
      }
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
      if (!user.password_hash) {
        return res.status(400).json({ success: false, error: '该账号未设置密码' });
      }
      const valid = await verifyPassword(user, oldPassword);
      if (!valid) return res.status(400).json({ success: false, error: '旧密码错误' });
      const hash = await hashPassword(newPassword);
      await User.updatePassword(user.id, hash);
      const token = signToken(user);
      res.json({ success: true, token, user: AuthController._publicUser(user), message: '密码修改成功' });
    } catch (error) {
      console.error('修改密码失败:', error);
      res.status(500).json({ success: false, error: '修改密码失败' });
    }
  }

  /** @deprecated 使用 authService.signToken；保留以兼容既有调用 */
  static _signToken(user) {
    return signToken(user);
  }
}

module.exports = AuthController;