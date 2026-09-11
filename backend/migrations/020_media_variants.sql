-- 020_media_variants.sql
-- 文件通路改造（2026-09）：照片/附件增加派生资源与元数据
--
-- 背景：相册列表与详情网格此前直接加载原图（单张 3–8MB），
-- 一个 30 张的相册在手机上要下 100MB+，实际不可用。
-- 现在上传时生成两档派生图：
--   thumb  —— 480px 方图，用于列表/网格（约 30–60KB）
--   medium —— 1440px 长边，用于查看器（约 200–400KB）
-- 原图（客户端已压缩）仅在需要时下载。
--
-- 幂等：ADD COLUMN 前先判断 information_schema。

SET @db := DATABASE();

-- photos.thumb_url
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'thumb_url');
SET @sql := IF(@has = 0, 'ALTER TABLE photos ADD COLUMN thumb_url VARCHAR(255) NULL AFTER url', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- photos.medium_url
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'medium_url');
SET @sql := IF(@has = 0, 'ALTER TABLE photos ADD COLUMN medium_url VARCHAR(255) NULL AFTER thumb_url', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 图片尺寸与体积（前端用于占位、排序与配额统计）
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'width');
SET @sql := IF(@has = 0, 'ALTER TABLE photos ADD COLUMN width INT NULL AFTER medium_url', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'height');
SET @sql := IF(@has = 0, 'ALTER TABLE photos ADD COLUMN height INT NULL AFTER width', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'size');
SET @sql := IF(@has = 0, 'ALTER TABLE photos ADD COLUMN size INT NULL AFTER height', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'mime');
SET @sql := IF(@has = 0, 'ALTER TABLE photos ADD COLUMN mime VARCHAR(64) NULL AFTER size', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 按相册 + 审核状态取图（详情页主查询）
SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'photos' AND INDEX_NAME = 'idx_photos_album_approved');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_photos_album_approved ON photos (album_id, is_approved, created_at)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 附件通用表（请假证明/报销凭证/作业附件等只存了 URL 字符串，
-- 这里补一张索引表便于反查"这个文件被谁引用、能不能删"，避免误删仍在使用的文件）
CREATE TABLE IF NOT EXISTS media_assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(255) NOT NULL,
  thumb_url VARCHAR(255) NULL,
  medium_url VARCHAR(255) NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'resource',
  owner_id INT NULL,
  class_id VARCHAR(20) NULL,
  filename VARCHAR(255) NULL,
  mime VARCHAR(64) NULL,
  size INT NULL,
  width INT NULL,
  height INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_media_url (url),
  KEY idx_media_owner (owner_id),
  KEY idx_media_kind_created (kind, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
