-- 迁移脚本：六区队 + 操作记录表
-- 用法：在已部署的数据库上执行本文件即可
--   mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < backend/migrations/2026-04-20-admin-members.sql

USE class_manage_sys;

-- 1. 班级补齐：六区队
INSERT IGNORE INTO classes (id, name) VALUES ('class006', '六区队');

-- 2. 操作记录表
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

SELECT '迁移完成：六区队 + operation_logs' AS message;
