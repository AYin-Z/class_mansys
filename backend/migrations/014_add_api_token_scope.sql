-- 014_add_api_token_scope.sql
-- 个人访问令牌的作用域：默认只读；allow_write=1 才允许暴露写操作工具（写操作仍需二次确认）
-- 幂等写法：列已存在时跳过（测试库从生产库克隆结构，可能已经带上该列）

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_tokens' AND COLUMN_NAME = 'allow_write'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE api_tokens ADD COLUMN allow_write TINYINT(1) NOT NULL DEFAULT 0 AFTER prefix',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
