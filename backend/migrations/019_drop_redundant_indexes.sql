-- 019_drop_redundant_indexes.sql
-- users.student_id 已有 UNIQUE 约束（唯一索引），再建普通索引纯属冗余：
--   idx_test            —— 仓库无出处（手工创建），已确认无任何查询依赖
--   idx_users_student_id —— database_init.sql:471 里创建，同样是 student_id 上的重复索引
-- 冗余索引只增加写入成本与磁盘占用，这里幂等删除（不存在则跳过）。

SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_test');
SET @sql := IF(@has > 0, 'DROP INDEX idx_test ON users', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_student_id');
SET @sql := IF(@has > 0, 'DROP INDEX idx_users_student_id ON users', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
