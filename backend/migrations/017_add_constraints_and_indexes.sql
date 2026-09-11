-- 017_add_constraints_and_indexes.sql
-- 批次 3c：数据一致性护栏 —— 补唯一键 + 补缺失索引（全量幂等，可重复执行）
--
-- 约定：
--   1) 所有 DDL 都用 information_schema 预判 + PREPARE 动态执行，重跑安全；
--   2) 重复数据会阻断唯一键创建，因此：
--      - homework_submissions / challenge_applications：先"去重前置"（保留 id 最大的最新一条），再建唯一键；
--      - fee_collections / companies：重复行涉及财务批次与中队主数据，静默删除有数据丢失风险，
--        故检测到重复时"跳过建键 + 输出告警结果集"，需人工去重后重跑本迁移；
--   3) 索引按"名字"预判（若已存在同名索引则跳过，不重复建）。

SET @schema_name := DATABASE();

-- ============================================================
-- 一、唯一键
-- ============================================================

-- homework_submissions：同一份作业同一名学员只允许一条提交记录
-- 去重前置：同一 (homework_id, user_id) 的多条记录里，保留 id 最大（最新）的一条
DELETE h FROM homework_submissions h
JOIN (
  SELECT homework_id, user_id, MAX(id) AS keep_id
  FROM homework_submissions
  GROUP BY homework_id, user_id
  HAVING COUNT(*) > 1
) d ON d.homework_id = h.homework_id AND d.user_id = h.user_id AND h.id <> d.keep_id;

SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE homework_submissions ADD UNIQUE KEY uk_homework_user (homework_id, user_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'homework_submissions' AND INDEX_NAME = 'uk_homework_user');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- challenge_applications：同一擂台同一名学员只允许一条申请记录
-- 去重前置：保留 id 最大（最新）的一条
DELETE a FROM challenge_applications a
JOIN (
  SELECT challenge_id, user_id, MAX(id) AS keep_id
  FROM challenge_applications
  GROUP BY challenge_id, user_id
  HAVING COUNT(*) > 1
) d ON d.challenge_id = a.challenge_id AND d.user_id = a.user_id AND a.id <> d.keep_id;

SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE challenge_applications ADD UNIQUE KEY uk_challenge_user (challenge_id, user_id)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'challenge_applications' AND INDEX_NAME = 'uk_challenge_user');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- fee_collections：同一区队 + 同一批次（标题 + 学期）只允许一条收缴批次
-- 注意：class_id 为 NULL（全局/中队级）时 MySQL 唯一索引不去重 NULL，多行 NULL 属预期；
--       检测到重复数据时跳过并告警，避免误删财务批次（明细表有级联删除）。
SET @sql := (
  SELECT IF(
    COUNT(*) = 0 AND (
      SELECT COUNT(*) FROM (
        SELECT 1 FROM fee_collections GROUP BY class_id, title, semester HAVING COUNT(*) > 1 LIMIT 1
      ) dup
    ) = 0,
    'ALTER TABLE fee_collections ADD UNIQUE KEY uk_fee_collection_batch (class_id, title, semester)',
    'SELECT ''017 告警: fee_collections 存在重复的 (class_id,title,semester)，已跳过唯一键 uk_fee_collection_batch，请人工去重后重跑本迁移'' AS warning'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fee_collections' AND INDEX_NAME = 'uk_fee_collection_batch'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- companies：中队名唯一（重名会让"按名称找中队"二义）
-- 检测到重名时跳过并告警（companies 被 classes.company_id 外键引用，不宜在迁移里删行）。
SET @sql := (
  SELECT IF(
    COUNT(*) = 0 AND (
      SELECT COUNT(*) FROM (
        SELECT 1 FROM companies GROUP BY name HAVING COUNT(*) > 1 LIMIT 1
      ) dup
    ) = 0,
    'ALTER TABLE companies ADD UNIQUE KEY uk_companies_name (name)',
    'SELECT ''017 告警: companies 存在重名，已跳过唯一键 uk_companies_name，请人工去重后重跑本迁移'' AS warning'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'companies' AND INDEX_NAME = 'uk_companies_name'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 二、缺失索引
-- ============================================================

-- users.member_type：在编身份过滤（花名册/出勤分母）
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_users_member_type ON users (member_type)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_member_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- leaves(status, is_cancelled, end_time)：待审批 / 未销假 / 到期统计
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_leaves_status_cancel_end ON leaves (status, is_cancelled, end_time)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'leaves' AND INDEX_NAME = 'idx_leaves_status_cancel_end');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expenses(status)：待审批列表
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_expenses_status ON expenses (status)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'expenses' AND INDEX_NAME = 'idx_expenses_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expenses(created_at)：按月/时间范围汇总
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_expenses_created_at ON expenses (created_at)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'expenses' AND INDEX_NAME = 'idx_expenses_created_at');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- fee_collection_records(paid_at)：收缴进度/已缴筛选
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_fee_records_paid_at ON fee_collection_records (paid_at)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'fee_collection_records' AND INDEX_NAME = 'idx_fee_records_paid_at');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notices(class_id, created_at)：区队维度按时间倒序拉列表（已有的 idx_notices_class_id 只有单列）
SET @sql := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX idx_notices_class_created ON notices (class_id, created_at)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'notices' AND INDEX_NAME = 'idx_notices_class_created');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
