-- 025_agent_action_risk.sql
-- 写操作确认卡片：风险分级与影响面（2026-09-12）
--
-- 背景：原来所有写操作共用一张卡片，内容是 `工具名 | JSON` + 一个「确认执行」按钮。
-- 问题不是"用户可能不看"，而是这张卡片本身没有可看的东西——没有影响面、没有后果、
-- 没有"这条会推送给谁"。人不会读它，只会点。
--
-- 所以把「风险级别」和「影响面」显式存进来：
--   risk      low / medium / high —— 前端据此决定摩擦强度（高危必须勾选核对才能确认）
--   impact    人话描述的真实影响面（如"全中队 215 人会立刻收到这条推送，发布后无法撤回"）
--             这个数字由后端查库得出，绝不用模型说的。
--
-- 幂等：ADD COLUMN 前先查 information_schema。

SET @db := DATABASE();

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'risk');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN risk VARCHAR(8) NOT NULL DEFAULT ''medium'' AFTER preview', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agent_actions' AND COLUMN_NAME = 'impact');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_actions ADD COLUMN impact VARCHAR(255) DEFAULT NULL AFTER risk', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
