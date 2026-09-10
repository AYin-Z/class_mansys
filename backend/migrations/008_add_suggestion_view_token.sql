-- 008_add_suggestion_view_token.sql
-- 匿名建议：增加 view_token，用户只能凭 token 反查自己的提交，避免按 id 枚举读取

SET @schema_name := DATABASE();

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE suggestions ADD COLUMN view_token VARCHAR(64) DEFAULT NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'suggestions' AND COLUMN_NAME = 'view_token'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX idx_suggestion_view_token ON suggestions(view_token)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'suggestions' AND INDEX_NAME = 'idx_suggestion_view_token'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
