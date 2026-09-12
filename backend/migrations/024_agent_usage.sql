-- 024_agent_usage.sql
-- 对话助手用量记账（P0 观测，2026-09-12）
--
-- 为什么记原始 token 而不是只记一个成本数字：
--   价目表会变（DeepSeek 分峰谷时段、模型换代、将来本地模型占绝大多数轮次成本为 0），
--   只记成本等于把当时的价目表焊死在历史里，以后想重算都算不了。
--   所以这里只落原始 token，成本由代码按当前价目表现算（services/agent/usage.js）。
--
-- 为什么不加 user_id 外键：
--   记账数据要能独立于用户生命周期存在。删用户时把账删掉，等于把历史成本抹了。

CREATE TABLE IF NOT EXISTS agent_usage (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  role INT NOT NULL DEFAULT 0,
  conversation_id BIGINT DEFAULT NULL,
  step_index INT NOT NULL DEFAULT 0,
  served_by VARCHAR(16) NOT NULL DEFAULT 'unknown',
  model VARCHAR(96) DEFAULT NULL,
  fell_back TINYINT(1) NOT NULL DEFAULT 0,
  streamed TINYINT(1) NOT NULL DEFAULT 0,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  cache_hit_tokens INT NOT NULL DEFAULT 0,
  cache_miss_tokens INT NOT NULL DEFAULT 0,
  cost_cny DECIMAL(12,6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_usage_created (created_at),
  INDEX idx_agent_usage_served (served_by, created_at),
  INDEX idx_agent_usage_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
