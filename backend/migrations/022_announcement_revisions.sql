-- 022_announcement_revisions.sql
-- 公告可编辑 + 修改记录 + 回退（P3-4）
--
-- 背景：公告发出后无法编辑（接口只有 create/delete），改一条只能删了重发，
-- 会换 ID、重置已读状态；而公告是"公开告知"，内容经常需要小幅修订（时间、地点、名单）。
--
-- 设计：每次改动（发布 / 编辑 / 回退）都写一条不可变快照，
-- 详情页永远展示 announcements 表里的当前值，修订历史用于后台查看与回退。
-- 回退本身也是一次新的修订（复制旧内容为新版本），历史不丢。

CREATE TABLE IF NOT EXISTS announcement_revisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  announcement_id INT NOT NULL,
  version INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  editor_id INT NULL,
  /** 本次修订来源：publish=首次发布 edit=编辑 revert=回退 */
  source VARCHAR(16) NOT NULL DEFAULT 'edit',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ann_version (announcement_id, version),
  KEY idx_ann_rev_time (announcement_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 存量公告回填 v1（幂等：只补没有修订记录的）
INSERT INTO announcement_revisions (announcement_id, version, title, content, is_pinned, editor_id, source, created_at)
SELECT a.id, 1, a.title, a.content, a.is_pinned, a.creator_id, 'publish', a.created_at
FROM announcements a
WHERE NOT EXISTS (
  SELECT 1 FROM announcement_revisions r WHERE r.announcement_id = a.id
);
