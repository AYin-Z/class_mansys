import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';

// 必须在 require app 之前覆盖环境，避免连到生产库
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const User = require('../../models/User');
const AuthController = require('../../controllers/AuthController');

const TOKEN = jwt.sign({ id: 1, role: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
const originalFindByStudentId = User.findByStudentId;

afterEach(() => { User.findByStudentId = originalFindByStudentId; });

describe('POST /api/auth/find-by-student 隐私收敛', () => {
  it('不带令牌 401', async () => {
    const res = await request(app).post('/api/auth/find-by-student').send({ student_id: '202521710001' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('带令牌只返回脱敏信息（无 phone/email/openid，姓名只留首字）', async () => {
    // 打桩用户模型，避免依赖真实数据库
    User.findByStudentId = async () => ({
      id: 7,
      name: '张三',
      student_id: '202521710001',
      class_id: '侦查2101',
      role: 0,
      phone: '13800000000',
      email: 'zhangsan@example.com',
      openid: 'wx_openid_secret'
    });

    const res = await request(app)
      .post('/api/auth/find-by-student')
      .set('Authorization', 'Bearer ' + TOKEN)
      .send({ student_id: '202521710001' });

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.user.name).toBe('张*');
    expect(res.body.user.class_id).toBe('侦查2101');
    expect(res.body.user).not.toHaveProperty('phone');
    expect(res.body.user).not.toHaveProperty('email');
    expect(res.body.user).not.toHaveProperty('openid');

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('13800000000');
    expect(raw).not.toContain('zhangsan@example.com');
    expect(raw).not.toContain('wx_openid_secret');
  });

  it('学号不存在：404 且响应体不含联系方式字段', async () => {
    User.findByStudentId = async () => null;
    const res = await request(app)
      .post('/api/auth/find-by-student')
      .set('Authorization', 'Bearer ' + TOKEN)
      .send({ student_id: '202521719999' });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/phone|email|openid/);
  });
});

describe('_publicUser：手机号/邮箱仅本人可见', () => {
  const row = {
    id: 7,
    name: '张三',
    nickName: 'zs',
    student_id: '202521710001',
    class_id: '侦查2101',
    role: 0,
    phone: '13800000000',
    email: 'zhangsan@example.com'
  };

  it('未传 viewerId：不返回 phone/email', () => {
    const out = AuthController._publicUser(row);
    expect(out).not.toHaveProperty('phone');
    expect(out).not.toHaveProperty('email');
    expect(out.student_id).toBe('202521710001');
  });

  it('viewerId 非本人：不返回 phone/email', () => {
    const out = AuthController._publicUser(row, 99);
    expect(out).not.toHaveProperty('phone');
    expect(out).not.toHaveProperty('email');
  });

  it('viewerId 与用户 id 一致（本人）：返回 phone/email', () => {
    const out = AuthController._publicUser(row, 7);
    expect(out.phone).toBe('13800000000');
    expect(out.email).toBe('zhangsan@example.com');
  });
});
