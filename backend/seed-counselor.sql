-- ═══════════════════════════════════════════════════
-- 辅导员账户 seed
-- 用法：mysql -u root -p class_mansys < backend/seed-counselor.sql
-- ═══════════════════════════════════════════════════

-- 插入辅导员（role=9），密码需在首次登录后修改
INSERT INTO users (name, student_id, role, password, phone, email, created_at)
SELECT '王恒老师', '000000000', 9,
       '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQkf5fL4G6VQJ3Y5ENvGdCz5RyHVu',
       '', 'wangheng@ppsc.edu.cn', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE student_id = '000000000'
);
