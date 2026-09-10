-- 011_add_user_member_type.sql
-- 修复身份模型缺陷：role 只表示岗位/权限；新增 member_type 表示在编身份
--   student = 在编学员（含班干部，计入花名册/出勤分母）
--   staff   = 辅导员/外部人员（不计入区队出勤）
--   system  = 系统账号（不计入区队出勤）

SET @schema_name := DATABASE();

SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE users ADD COLUMN member_type VARCHAR(16) NOT NULL DEFAULT ''student''', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'member_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 首次应用时按 role 回填（若已有人工设置过 staff/system 则跳过，避免覆盖人工配置）
SET @sql := IF((SELECT COUNT(*) FROM users WHERE member_type <> 'student') = 0,
  'UPDATE users SET member_type = CASE WHEN role BETWEEN 0 AND 7 THEN ''student'' WHEN role = 8 THEN ''system'' WHEN role = 9 THEN ''staff'' ELSE ''student'' END',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
