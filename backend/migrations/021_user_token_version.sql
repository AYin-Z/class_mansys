-- 021_user_token_version.sql
-- 会话可吊销（P2-2）：给 users 增加 token_version
--
-- 背景：JWT 是无状态的，签发后 24h 内一直有效。改密码 / 管理员重置密码 / 成员被移出后，
-- 旧令牌仍然能继续访问，无法把人"踢下线"（令牌泄露时只能干等过期）。
--
-- 方案：users.token_version 作为该用户的"令牌代次"。
--   - 签发 JWT 时把当前值写进 tv 声明；
--   - 校验时比对 tv 与库里的当前值，不一致即 401（登录状态已失效，请重新登录）；
--   - 改密 / 重置密码 / 移出 / 删除时 +1，旧令牌全部作废。
--
-- 兼容：迁移前签发的旧令牌没有 tv 声明，按 tv = 0 处理 —— 迁移后所有人不会被立刻踢下线；
-- 一旦该用户发生上述"代次变更"，其旧令牌（0）与新值不一致即失效，符合预期。
--
-- 幂等：ADD COLUMN 前先查 information_schema；索引同理。

SET @db := DATABASE();

-- users.token_version
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version');
SET @sql := IF(@has = 0, 'ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER password_hash', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 历史行兜底：理论上 NOT NULL DEFAULT 0 已覆盖，这里防止列曾以可空形式存在过
UPDATE users SET token_version = 0 WHERE token_version IS NULL;
