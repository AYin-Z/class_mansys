/**
 * 辅导员账户 seed 脚本
 *
 * 用法: node backend/seed-counselor.js
 *
 * 创建「王恒老师」辅导员账号 (role=9)
 * 初始密码: 123456（首次登录后建议修改）
 */
const bcrypt = require('bcryptjs');
const db = require('./config/database');

const COUNSELOR = {
  name: '王恒老师',
  student_id: '000000000',
  role: 9,
  password: bcrypt.hashSync('123456', 10),
  phone: '',
  email: 'wangheng@ppsc.edu.cn',
  nickName: '王恒',
  openid: 'counselor_seed',
  avatarUrl: '',
  class_id: '0'
};

async function seed() {
  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE student_id = ?', [COUNSELOR.student_id]
    );
    if (existing.length > 0) {
      console.log('✓ 辅导员账号已存在 (id=' + existing[0].id + ')，跳过创建');
      return;
    }

    const [result] = await db.query(
      'INSERT INTO users (openid, nickName, avatarUrl, class_id, name, student_id, role, password_hash, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [COUNSELOR.openid, COUNSELOR.nickName, COUNSELOR.avatarUrl, COUNSELOR.class_id, COUNSELOR.name, COUNSELOR.student_id, COUNSELOR.role, COUNSELOR.password, COUNSELOR.phone, COUNSELOR.email]
    );
    console.log('✓ 辅导员账号创建成功 (id=' + result.insertId + ')');
    console.log('  姓名: 王恒老师');
    console.log('  学号: 000000000');
    console.log('  初始密码: 123456');
  } catch (err) {
    console.error('✗ 创建失败:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
