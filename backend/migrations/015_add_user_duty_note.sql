-- 015_add_user_duty_note.sql
-- 名册职务备注：例如「临时」「协助生副」等，用于一个岗位多人时的现实情况
-- 幂等写法：列已存在时跳过（测试库从生产库克隆结构，可能已带上该列）

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'duty_note'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE users ADD COLUMN duty_note VARCHAR(50) DEFAULT NULL AFTER role',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
