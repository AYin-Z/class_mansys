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

  static async register(req, res) {
    const { openid, userData } = req.body;
    
    try {
      // 检查是否已注册
      const existingUser = await User.findByOpenid(openid);
      if (existingUser) {
        return res.status(400).json({ success: false, error: '用户已注册' });
      }
      
      // 创建用户
      const userId = await User.create({
        openid,
        ...userData
      });
      
      res.json({ success: true, userId });
    } catch (error) {
      console.error('注册失败:', error);
      res.status(500).json({ success: false, error: '注册失败' });
    }
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