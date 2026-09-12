-- 023_pagination_indexes.sql
-- 分页查询所需的复合索引（2026-09 P1-3 配套）
--
-- 列表分页统一按 `created_at DESC, id DESC`（照片用游标），
-- 若只有 created_at 单列索引，同秒多条时仍需 filesort；
-- 补 (created_at, id) 复合索引让排序走索引、游标条件也能用上。
--
-- 幂等：先查 information_schema 再决定是否创建。

SET @db := DATABASE();

-- notices(created_at, id)
SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notices' AND INDEX_NAME = 'idx_notices_created_id');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_notices_created_id ON notices (created_at, id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- leaves(created_at, id)
SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'leaves' AND INDEX_NAME = 'idx_leaves_created_id');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_leaves_created_id ON leaves (created_at, id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- homeworks(created_at, id) —— 注意表名是复数（历史结构如此）
SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'homeworks' AND INDEX_NAME = 'idx_homeworks_created_id');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_homeworks_created_id ON homeworks (created_at, id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- photos 相册游标：已有 idx_photos_album_approved(album_id, is_approved, created_at)，
-- 但游标还要按 id 次级排序，这里带上 id 形成覆盖排序的索引
SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND INDEX_NAME = 'idx_photos_album_cursor');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_photos_album_cursor ON photos (album_id, is_approved, created_at, id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
