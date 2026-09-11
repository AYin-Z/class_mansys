-- 018_add_missing_columns.sql
-- 补齐「模型已在用、但仓库 DDL/迁移里缺失」的列（审计发现：新环境会直接 500）
-- 幂等写法：information_schema 预判 + PREPARE（项目迁移惯例）

-- 1) lotteries.drawn_at：开奖幂等标记
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lotteries' AND COLUMN_NAME = 'drawn_at');
SET @sql := IF(@has = 0, 'ALTER TABLE lotteries ADD COLUMN drawn_at DATETIME DEFAULT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) announcements.is_pinned：首页置顶（controller/model 已在用）
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'is_pinned');
SET @sql := IF(@has = 0, 'ALTER TABLE announcements ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) challenge_applications.proof_urls / notes
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'challenge_applications' AND COLUMN_NAME = 'proof_urls');
SET @sql := IF(@has = 0, 'ALTER TABLE challenge_applications ADD COLUMN proof_urls TEXT DEFAULT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'challenge_applications' AND COLUMN_NAME = 'notes');
SET @sql := IF(@has = 0, 'ALTER TABLE challenge_applications ADD COLUMN notes VARCHAR(500) DEFAULT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) fees：fee_collections.class_id 已有；expenses.class_id 已有（010）
