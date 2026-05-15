-- 为 homeworks 表和 notices 表添加 attachments 字段（JSON 格式存储附件数组）
-- 附件格式：[ { name: string, url: string, size: number, type: string } ]

ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS attachments JSON DEFAULT NULL AFTER deadline;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS attachments JSON DEFAULT NULL AFTER is_pinned;
