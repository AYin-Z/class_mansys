-- 028_channel_push.sql
-- 微信主动推送：推送日志（幂等 + 频率纪律）与用户偏好
--
-- 为什么必须有幂等键：推送脚本会定时反复跑，而"作业明天截止"这种事只要说一次。
-- 没有 (user_id, dedupe_key) 唯一键，用户每天会收到同一条提醒——这比不推还糟（会被屏蔽）。
--
-- 为什么要记日志：聊天渠道最大的风险是变成骚扰源。纪律（每人每天 ≤N 条、同类合并、
-- 可关闭）必须由数据层保证，不能靠调用方自觉。

CREATE TABLE IF NOT EXISTS channel_push_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  channel VARCHAR(16) NOT NULL DEFAULT 'weixin',
  type VARCHAR(32) NOT NULL,
  dedupe_key VARCHAR(96) DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'sent',
  detail VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_push_dedupe (user_id, dedupe_key),
  INDEX idx_push_user_day (user_id, created_at),
  INDEX idx_push_type (type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户可按类型关闭推送（NULL = 全部开启）
SET @db := DATABASE();
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_channel_bindings' AND COLUMN_NAME = 'push_prefs');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_channel_bindings ADD COLUMN push_prefs JSON DEFAULT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
