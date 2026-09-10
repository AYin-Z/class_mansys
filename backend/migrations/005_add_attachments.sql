-- 005_add_attachments.sql（幂等版）
-- 为 homeworks / notices / leaves 增加 attachments JSON 字段
SET @schema_name := DATABASE();

-- homeworks.attachments
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE homeworks ADD COLUMN attachments JSON DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'homeworks' AND COLUMN_NAME = 'attachments');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notices.attachments
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE notices ADD COLUMN attachments JSON DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'notices' AND COLUMN_NAME = 'attachments');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- leaves.attachments
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE leaves ADD COLUMN attachments JSON DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'leaves' AND COLUMN_NAME = 'attachments');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
