-- 数据库初始化脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS class_manage_sys CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE class_manage_sys;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(100) UNIQUE NOT NULL,
  nickName VARCHAR(50) NOT NULL,
  avatarUrl VARCHAR(255) NOT NULL,
  gender INT NOT NULL DEFAULT 0,
  student_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(20) NOT NULL,
  class_id VARCHAR(20) NOT NULL,
  role INT NOT NULL DEFAULT 0,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 请假表
CREATE TABLE IF NOT EXISTS leaves (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  leave_type VARCHAR(20) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  reason TEXT NOT NULL,
  status INT NOT NULL DEFAULT 0,
  approver_id INT,
  approval_time DATETIME,
  approval_notes TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancelled_time DATETIME,
  cancel_time DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (approver_id) REFERENCES users(id)
);

-- 通知表
CREATE TABLE IF NOT EXISTS notices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  attachments JSON DEFAULT NULL,
  creator_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 通知阅读表
CREATE TABLE IF NOT EXISTS notice_reads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  notice_id INT NOT NULL,
  user_id INT NOT NULL,
  read_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notice_id) REFERENCES notices(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_notice_user (notice_id, user_id)
);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  creator_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 资源表
CREATE TABLE IF NOT EXISTS resources (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  url VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL,
  uploader_id INT NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);

-- 相册表
CREATE TABLE IF NOT EXISTS albums (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  creator_id INT NOT NULL,
  permission INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 照片表
CREATE TABLE IF NOT EXISTS photos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  album_id INT NOT NULL,
  url VARCHAR(255) NOT NULL,
  description TEXT,
  uploader_id INT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by INT,
  approved_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (album_id) REFERENCES albums(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- 留言表
CREATE TABLE IF NOT EXISTS messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content TEXT NOT NULL,
  user_id INT NOT NULL,
  target_id INT NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  parent_id INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES messages(id)
);

-- 班费表
CREATE TABLE IF NOT EXISTS expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL,
  purpose TEXT NOT NULL,
  status INT NOT NULL DEFAULT 0,
  approver_id INT,
  approval_time DATETIME,
  approval_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (approver_id) REFERENCES users(id)
);

-- 心理干预申请表
CREATE TABLE IF NOT EXISTS psychological_applications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  status INT NOT NULL DEFAULT 0,
  handler_id INT,
  handler_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (handler_id) REFERENCES users(id)
);

-- 擂台表
CREATE TABLE IF NOT EXISTS challenges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  current_champion_id INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (current_champion_id) REFERENCES users(id)
);

-- 擂台申请表
CREATE TABLE IF NOT EXISTS challenge_applications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  challenge_id INT NOT NULL,
  user_id INT NOT NULL,
  status INT NOT NULL DEFAULT 0,
  approver_id INT,
  approval_time DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (approver_id) REFERENCES users(id)
);

-- 挑战记录表
CREATE TABLE IF NOT EXISTS challenge_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  challenge_id INT NOT NULL,
  challenger_id INT NOT NULL,
  champion_id INT NOT NULL,
  result VARCHAR(20) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id),
  FOREIGN KEY (challenger_id) REFERENCES users(id),
  FOREIGN KEY (champion_id) REFERENCES users(id)
);

-- 投票表
CREATE TABLE IF NOT EXISTS votes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,
  creator_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 投票选项表
CREATE TABLE IF NOT EXISTS vote_options (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vote_id INT NOT NULL,
  content VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vote_id) REFERENCES votes(id)
);

-- 投票记录表
CREATE TABLE IF NOT EXISTS vote_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vote_id INT NOT NULL,
  user_id INT NOT NULL,
  option_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vote_id) REFERENCES votes(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (option_id) REFERENCES vote_options(id),
  UNIQUE KEY unique_vote_user_option (vote_id, user_id, option_id)
);

-- 作业表
CREATE TABLE IF NOT EXISTS homeworks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  creator_id INT NOT NULL,
  deadline DATETIME NOT NULL,
  attachments JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 作业提交表
CREATE TABLE IF NOT EXISTS homework_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  homework_id INT NOT NULL,
  user_id INT NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  file_name VARCHAR(100) NOT NULL,
  status INT NOT NULL DEFAULT 0,
  score INT,
  feedback TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (homework_id) REFERENCES homeworks(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 匿名建议表
CREATE TABLE IF NOT EXISTS suggestions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status INT NOT NULL DEFAULT 0,
  handler_id INT,
  handler_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (handler_id) REFERENCES users(id)
);

-- 抽奖活动表
CREATE TABLE IF NOT EXISTS lotteries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rules TEXT NOT NULL,
  creator_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 抽奖参与表
CREATE TABLE IF NOT EXISTS lottery_participants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lottery_id INT NOT NULL,
  user_id INT NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  prize VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lottery_id) REFERENCES lotteries(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_lottery_user (lottery_id, user_id)
);

-- 积分表
CREATE TABLE IF NOT EXISTS points (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  score INT NOT NULL,
  reason TEXT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 班级表
CREATE TABLE IF NOT EXISTS classes (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 操作记录表（用于管理员查看成员最近系统内操作）
CREATE TABLE IF NOT EXISTS operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(30),
  resource_id VARCHAR(64),
  method VARCHAR(10),
  path VARCHAR(200),
  status_code INT,
  ip VARCHAR(60),
  detail TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_op_user (user_id, created_at),
  INDEX idx_op_created (created_at)
);

-- 插入默认班级数据
INSERT IGNORE INTO classes (id, name) VALUES
('class001', '一区队'),
('class002', '二区队'),
('class003', '三区队'),
('class004', '四区队'),
('class005', '五区队'),
('class006', '六区队');

-- 插入默认管理员用户
INSERT IGNORE INTO users (openid, nickName, avatarUrl, gender, student_id, name, class_id, role, phone, email) VALUES
('admin_openid', '管理员', 'https://example.com/avatar.jpg', 1, 'admin001', '管理员', 'class001', 2, '13800138000', 'admin@example.com');

-- 插入默认测试数据
INSERT IGNORE INTO notices (title, content, type, creator_id) VALUES
('欢迎使用区队管理系统', '区队管理系统已正式上线，包含请假、通知、班费等功能', '系统通知', 1),
('关于开展春季体能训练的通知', '春季体能训练将于下周开始，请各位同学做好准备', '集合通知', 1);

INSERT IGNORE INTO announcements (title, content, creator_id) VALUES
('区队规章制度', '区队各项规章制度已更新，请各位同学认真学习', 1);

INSERT IGNORE INTO expenses (user_id, amount, type, purpose, status) VALUES
(1, 500.00, '收入', '班费收缴', 1),
(1, 100.00, '支出', '购买清洁用品', 1);

INSERT IGNORE INTO homeworks (title, description, creator_id, deadline) VALUES
('高数作业', '完成教材P100-105的习题', 1, DATE_ADD(NOW(), INTERVAL 7 DAY));

INSERT IGNORE INTO challenges (name, type, description) VALUES
('学习擂台', '学习', '每周测验成绩排名挑战'),
('体能擂台', '体能', '1000米跑步时间挑战');

INSERT IGNORE INTO votes (title, description, type, creator_id, start_time, end_time) VALUES
('春游地点选择', '选择今年春游的目的地', '单选', 1, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY));

INSERT IGNORE INTO vote_options (vote_id, content) VALUES
(1, '西湖'),
(1, '千岛湖'),
(1, '西溪湿地');

INSERT IGNORE INTO lotteries (name, description, rules, creator_id, start_time, end_time) VALUES
('月度抽奖', '每月抽奖活动', '每位同学可参与一次', 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH));

INSERT IGNORE INTO suggestions (content, category) VALUES
('建议增加自习室开放时间', '学习'),
('食堂饭菜质量需要改进', '生活');

INSERT IGNORE INTO points (user_id, score, reason, created_by) VALUES
(1, 10, '全勤奖励', 1),
(1, 5, '参与区队活动', 1);

-- 创建索引
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_class_id ON users(class_id);
CREATE INDEX idx_leaves_user_id ON leaves(user_id);
CREATE INDEX idx_notices_created_at ON notices(created_at);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_type ON expenses(type);
CREATE INDEX idx_homeworks_deadline ON homeworks(deadline);
CREATE INDEX idx_votes_end_time ON votes(end_time);
CREATE INDEX idx_lotteries_end_time ON lotteries(end_time);

-- 创建视图
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  u.id,
  u.name,
  u.student_id,
  u.class_id,
  u.role,
  COUNT(l.id) as leave_count,
  SUM(CASE WHEN l.status = 1 THEN 1 ELSE 0 END) as approved_leave_count,
  COALESCE(SUM(p.score), 0) as total_points
FROM users u
LEFT JOIN leaves l ON u.id = l.user_id
LEFT JOIN points p ON u.id = p.user_id
GROUP BY u.id;

CREATE OR REPLACE VIEW fee_summary AS
SELECT 
  SUM(CASE WHEN type = '收入' AND status = 1 THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN type = '支出' AND status = 1 THEN amount ELSE 0 END) as total_expense,
  SUM(CASE WHEN type = '收入' AND status = 1 THEN amount ELSE 0 END) - 
  SUM(CASE WHEN type = '支出' AND status = 1 THEN amount ELSE 0 END) as balance
FROM expenses;

-- 增强 expenses 表：支持三级审批流
ALTER TABLE expenses
  ADD COLUMN approval_step TINYINT DEFAULT 0 COMMENT '当前审批步骤: 0=未提交 1=待区队长 2=待辅导员 3=待投票',
  ADD COLUMN tier VARCHAR(10) DEFAULT 'small' COMMENT '金额档: small(≤100) / medium(100-500) / large(>500)',
  ADD COLUMN proof_url VARCHAR(500) COMMENT '凭证图片URL',
  ADD COLUMN details JSON COMMENT '明细项JSON数组',
  ADD COLUMN semester VARCHAR(20) COMMENT '所属学期';

-- 班费收缴批次表
CREATE TABLE IF NOT EXISTS fee_collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  amount_per_person DECIMAL(10,2) NOT NULL,
  total_expected DECIMAL(10,2) DEFAULT 0,
  collected_amount DECIMAL(10,2) DEFAULT 0,
  semester VARCHAR(20) NOT NULL,
  status TINYINT DEFAULT 0 COMMENT '0=收集中 1=已截止 2=已结清',
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 收缴记录表（每人每条）
CREATE TABLE IF NOT EXISTS fee_collection_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  collection_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  paid_at TIMESTAMP NULL,
  is_exempt BOOLEAN DEFAULT FALSE COMMENT '是否减免',
  remark VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES fee_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_collection_user (collection_id, user_id)
);

-- 审批流节点跟踪表
CREATE TABLE IF NOT EXISTS expense_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  expense_id INT NOT NULL,
  step TINYINT NOT NULL COMMENT '1=区队长审批 2=辅导员审批 3=匿名投票',
  approver_role TINYINT COMMENT '预期审批人角色',
  approver_id INT,
  status TINYINT DEFAULT 0 COMMENT '0=待审批 1=已通过 2=已驳回',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_id) REFERENCES users(id)
);

-- 投票记录表（大额审批专用）
CREATE TABLE IF NOT EXISTS expense_approval_votes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  expense_id INT NOT NULL,
  user_id INT NOT NULL,
  vote TINYINT NOT NULL COMMENT '1=同意 2=反对',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_vote_user (expense_id, user_id)
);

-- 月度公示表
CREATE TABLE IF NOT EXISTS fee_publications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  period VARCHAR(7) NOT NULL COMMENT '月份 YYYY-MM',
  total_income DECIMAL(10,2) DEFAULT 0,
  total_expense DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  details_json JSON COMMENT '收支明细快照',
  published_by INT NOT NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (published_by) REFERENCES users(id)
);

-- 新表索引
CREATE INDEX idx_fee_collections_semester ON fee_collections(semester);
CREATE INDEX idx_fee_collection_records_collection ON fee_collection_records(collection_id);
CREATE INDEX idx_expense_approvals_expense ON expense_approvals(expense_id);
CREATE INDEX idx_expense_approval_votes_expense ON expense_approval_votes(expense_id);
CREATE INDEX idx_fee_publications_period ON fee_publications(period);

-- 更新视图：反映 expenses 扩展字段
DROP VIEW IF EXISTS fee_summary;
CREATE OR REPLACE VIEW fee_summary AS
SELECT 
  SUM(CASE WHEN type = '收入' AND status = 1 THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN type = '支出' AND status = 1 THEN amount ELSE 0 END) as total_expense,
  SUM(CASE WHEN type = '收入' AND status = 1 THEN amount ELSE 0 END) - 
  SUM(CASE WHEN type = '支出' AND status = 1 THEN amount ELSE 0 END) as balance,
  COUNT(CASE WHEN tier = 'small' AND status = 0 THEN 1 END) as pending_small,
  COUNT(CASE WHEN tier = 'medium' AND status = 0 THEN 1 END) as pending_medium,
  COUNT(CASE WHEN tier = 'large' AND status = 0 THEN 1 END) as pending_large
FROM expenses;

-- 显示创建成功信息
SELECT '数据库初始化完成' as message;