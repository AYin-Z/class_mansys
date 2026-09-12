-- 027_agent_undo.sql
-- 写操作撤销（2026-09-12）
--
-- 背景：确认卡片拦不住闭眼点击。既然拦不住，就必须让**纠错变快**——
-- 而且撤销比事前确认更有效，因为用户是在**看到结果之后**才知道发生了什么。
--
-- 只对**真有反向端点**的操作提供撤销（通知/公告撤回、积分回滚、作业删除）。
-- 没有反向端点的操作（如提交匿名建议）不给假的撤销按钮——那比没有更糟。

CREATE TABLE IF NOT EXISTS agent_undo (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action_id BIGINT DEFAULT NULL,
  conversation_id BIGINT DEFAULT NULL,
  tool VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  method VARCHAR(8) NOT NULL,
  path VARCHAR(200) NOT NULL,
  params JSON DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'available',
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_undo_user (user_id, status, created_at),
  INDEX idx_agent_undo_expire (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
