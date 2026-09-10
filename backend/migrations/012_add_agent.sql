-- 012_add_agent.sql
-- 对话式 Agent：会话、消息、待确认动作（写操作两阶段确认）

CREATE TABLE IF NOT EXISTS agent_conversations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agent_conv_user (user_id, updated_at),
  CONSTRAINT fk_agent_conv_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT,
  tool_calls JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_msg_conv (conversation_id, id),
  CONSTRAINT fk_agent_msg_conv FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_actions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT DEFAULT NULL,
  user_id INT NOT NULL,
  tool VARCHAR(64) NOT NULL,
  method VARCHAR(8) NOT NULL,
  path VARCHAR(200) NOT NULL,
  params JSON DEFAULT NULL,
  preview VARCHAR(500) DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  result JSON DEFAULT NULL,
  expires_at DATETIME NOT NULL,
  executed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_action_user (user_id, status, created_at),
  CONSTRAINT fk_agent_action_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
