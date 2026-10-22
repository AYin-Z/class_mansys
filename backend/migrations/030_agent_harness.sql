-- 030_agent_harness.sql
-- Harness v2：连续任务、渠道会话、附件所有权、入站去重、确认版本与幂等
--
-- 只新增表/列/索引，不删除、不改写历史迁移，全部可重复执行（information_schema / IF NOT EXISTS）。
-- 回滚策略见 docs/AGENT_HARNESS_V2.md：停用新代码即可，旧代码不读新列/新表；
-- 数据层保留新列与新表，不做破坏性回退。

SET @db := DATABASE();

-- 1) 会话内的结构化任务状态（草稿 / 待确认 / 完成 / 失败）
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_conversations' AND COLUMN_NAME = 'state');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_conversations ADD COLUMN state JSON DEFAULT NULL AFTER title', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_conversations' AND COLUMN_NAME = 'state_version');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_conversations ADD COLUMN state_version INT NOT NULL DEFAULT 0 AFTER state', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_conversations' AND COLUMN_NAME = 'closed_at');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_conversations ADD COLUMN closed_at DATETIME DEFAULT NULL AFTER updated_at', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) 渠道身份 → 会话指针（同一 (channel, external_id) 只保留一行；轮换时更新指针）
CREATE TABLE IF NOT EXISTS agent_channel_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  channel VARCHAR(16) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  user_id INT NOT NULL,
  conversation_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_agent_channel_session (channel, external_id),
  INDEX idx_agent_channel_session_user (user_id, status),
  INDEX idx_agent_channel_session_expire (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) 对话附件所有权（URL 全局唯一；未登记或不属于本人一律拒绝）
CREATE TABLE IF NOT EXISTS agent_attachments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  conversation_id BIGINT DEFAULT NULL,
  url VARCHAR(500) NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  mime VARCHAR(120) DEFAULT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  sha256 CHAR(64) DEFAULT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'app',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_agent_attachment_url (url),
  INDEX idx_agent_attachment_user (user_id, id),
  INDEX idx_agent_attachment_conv (conversation_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) 渠道入站去重（worker 重放 / 长轮询重复下发）
CREATE TABLE IF NOT EXISTS agent_inbound_dedup (
  channel VARCHAR(16) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  message_id VARCHAR(160) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel, external_id, message_id),
  INDEX idx_agent_inbound_dedup_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) 待确认动作绑定具体状态版本 + 参数/配置哈希 + 原子抢占
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'state_version');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN state_version INT NOT NULL DEFAULT 0 AFTER status', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'params_hash');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN params_hash CHAR(64) DEFAULT NULL AFTER params', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'config_hash');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN config_hash CHAR(64) DEFAULT NULL AFTER params_hash', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'claim_token');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN claim_token CHAR(36) DEFAULT NULL AFTER config_hash', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'claimed_at');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN claimed_at DATETIME DEFAULT NULL AFTER claim_token', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'invalidated_at');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN invalidated_at DATETIME DEFAULT NULL AFTER claimed_at', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
