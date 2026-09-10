-- 010_add_class_scope.sql
-- 多区队隔离：为内容类表增加 class_id（NULL = 全局/中队级，所有区队可见）
-- 生成方式：动态幂等加列 + 加索引 + 从创建者/所属用户回填

SET @schema_name := DATABASE();

-- notices
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `notices` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'notices' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_notices_class_id ON `notices`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'notices' AND INDEX_NAME = 'idx_notices_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `notices` x JOIN users u ON x.creator_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- announcements
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `announcements` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_announcements_class_id ON `announcements`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'announcements' AND INDEX_NAME = 'idx_announcements_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `announcements` x JOIN users u ON x.creator_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- albums
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `albums` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_albums_class_id ON `albums`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'albums' AND INDEX_NAME = 'idx_albums_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `albums` x JOIN users u ON x.creator_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- homeworks
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `homeworks` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'homeworks' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_homeworks_class_id ON `homeworks`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'homeworks' AND INDEX_NAME = 'idx_homeworks_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `homeworks` x JOIN users u ON x.creator_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- votes
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `votes` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'votes' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_votes_class_id ON `votes`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'votes' AND INDEX_NAME = 'idx_votes_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `votes` x JOIN users u ON x.creator_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- lotteries
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `lotteries` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'lotteries' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_lotteries_class_id ON `lotteries`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'lotteries' AND INDEX_NAME = 'idx_lotteries_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `lotteries` x JOIN users u ON x.creator_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- messages
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `messages` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_messages_class_id ON `messages`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'messages' AND INDEX_NAME = 'idx_messages_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `messages` x JOIN users u ON x.user_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- resources
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `resources` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'resources' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_resources_class_id ON `resources`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'resources' AND INDEX_NAME = 'idx_resources_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `resources` x JOIN users u ON x.uploader_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- points
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `points` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'points' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_points_class_id ON `points`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'points' AND INDEX_NAME = 'idx_points_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `points` x JOIN users u ON x.user_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- psychological_applications
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `psychological_applications` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'psychological_applications' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_psychological_applications_class_id ON `psychological_applications`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'psychological_applications' AND INDEX_NAME = 'idx_psychological_applications_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `psychological_applications` x JOIN users u ON x.user_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- expenses
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `expenses` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_expenses_class_id ON `expenses`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'expenses' AND INDEX_NAME = 'idx_expenses_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `expenses` x JOIN users u ON x.user_id = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- fee_collections
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `fee_collections` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fee_collections' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_fee_collections_class_id ON `fee_collections`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fee_collections' AND INDEX_NAME = 'idx_fee_collections_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `fee_collections` x JOIN users u ON x.created_by = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- fee_publications
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `fee_publications` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fee_publications' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_fee_publications_class_id ON `fee_publications`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fee_publications' AND INDEX_NAME = 'idx_fee_publications_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `fee_publications` x JOIN users u ON x.published_by = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, '0'), '') WHERE x.class_id IS NULL;

-- challenges 无创建者列，保持全局（class_id 由后续业务写入）
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `challenges` ADD COLUMN class_id VARCHAR(20) DEFAULT NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'challenges' AND COLUMN_NAME = 'class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_challenges_class_id ON `challenges`(class_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'challenges' AND INDEX_NAME = 'idx_challenges_class_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
