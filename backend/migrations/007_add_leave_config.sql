-- 007_add_leave_config.sql（幂等版）
-- 请假类型配置表：管理员可在后台动态修改各请假类型的时间窗口、理由选项等

CREATE TABLE IF NOT EXISTS leave_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type_name VARCHAR(20) NOT NULL COMMENT '请假类型名称（早操/早集合/午集合/收假集合/晚自习/中队会/全休/其他）',
  start_time TIME DEFAULT NULL COMMENT '固定时段起始（如 06:00），自由时段为 NULL',
  end_time TIME DEFAULT NULL COMMENT '固定时段结束（如 07:00），自由时段为 NULL',
  is_fixed BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'true=固定时段（用户只选日期） false=自由时段（用户自选起止时间）',
  reasons JSON NOT NULL COMMENT '可选理由列表',
  enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序权重',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leave_config_type (type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 已存在的旧表补唯一键（幂等）
SET @schema_name := DATABASE();
SET @sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE leave_config ADD UNIQUE KEY uk_leave_config_type (type_name)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'leave_config' AND INDEX_NAME = 'uk_leave_config_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 初始化 8 种请假类型的默认配置（重复执行安全）
INSERT IGNORE INTO leave_config (type_name, start_time, end_time, is_fixed, reasons, sort_order) VALUES
('早操',   '06:00', '07:00', TRUE,  '["调休","出督","病假","事假","公假","其他"]', 1),
('早集合', '07:00', '08:10', TRUE,  '["调休","出督","病假","事假","公假","其他"]', 2),
('午集合', '13:00', '14:00', TRUE,  '["调休","出督","病假","事假","公假","其他"]', 3),
('收假集合','18:00','19:00', TRUE,  '["调休","出督","病假","事假","公假","其他"]', 4),
('晚自习', '18:30', '20:30', TRUE,  '["调休","出督","病假","事假","公假","其他"]', 5),
('中队会', NULL,    NULL,    FALSE, '["病假","事假","公假","其他"]', 6),
('全休',   NULL,    NULL,    FALSE, '["病假","事假","公假","其他"]', 7),
('其他',   NULL,    NULL,    FALSE, '["病假","事假","公假","其他"]', 8);
