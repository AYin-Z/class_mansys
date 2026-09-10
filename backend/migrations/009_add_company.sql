-- 009_add_company.sql
-- 中队化地基：新增 companies（中队）表，并在 classes（区队）上挂 company_id

CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) DEFAULT NULL,
  description VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name := DATABASE();

-- classes.company_id 列（幂等）
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE classes ADD COLUMN company_id VARCHAR(20) DEFAULT NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'company_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 外键（幂等）
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE classes ADD CONSTRAINT fk_classes_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL',
    'SELECT 1'
  )
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name AND TABLE_NAME = 'classes' AND CONSTRAINT_NAME = 'fk_classes_company'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 索引（幂等）
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX idx_classes_company_id ON classes(company_id)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'classes' AND INDEX_NAME = 'idx_classes_company_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
