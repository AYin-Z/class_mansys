#!/usr/bin/env node
/**
 * 真实链路探针：用**线上同一套** prompt / 工具目录 / 工具执行器跑一轮对话，
 * 用来复现真实投诉（评测脚本只发一轮、不执行工具，测不出多步串联的问题）。
 *
 * 用法:  node scripts/agent-probe.js "<用户消息>" [userId]      # 默认 34 = 殷政
 *
 * 跑完会打印 conversationId，接着用 agent_messages 看全过程（含每一步的 tool_calls）：
 *   docker exec class_mansys_db mysql --default-character-set=utf8mb4 -uroot -p*** \
 *     class_manage_sys -e "SELECT id,role,LEFT(content,120),tool_calls FROM agent_messages \
 *     WHERE conversation_id=<id> ORDER BY id;"
 *
 * ⚠️ 会产生真实会话记录（写入 agent_conversations/agent_messages/agent_actions/agent_usage）。
 *    调试完记得删掉：见文件末尾的清理 SQL。
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const app = require('../app');
const pool = require('../config/database');
const { signToken } = require('../services/authService');
const AgentService = require('../services/agent/agentService');

(async () => {
  const message = process.argv[2];
  const userId = Number(process.argv[3] || 34);
  if (!message) {
    console.error('用法: node scripts/agent-probe.js "<用户消息>" [userId]');
    process.exit(2);
  }
  await require('../shared/permissions').loadPermissions();
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!rows.length) {
    console.error('用户不存在: ' + userId);
    process.exit(2);
  }
  const user = rows[0];
  const token = signToken(user);
  const t0 = Date.now();
  const r = await AgentService.chat(user, token, { message }, app);
  console.log(`=== 会话 ${r.conversationId}（用户 ${user.name} role=${user.role}，${Date.now() - t0}ms）===`);
  console.log('用户: ' + message);
  console.log('助手: ' + r.reply);
  if (r.pendingAction) console.log('（生成了待确认的写操作）');
  console.log('\n清理本会话记录：');
  console.log(`  DELETE FROM agent_messages WHERE conversation_id=${r.conversationId};`);
  console.log(`  DELETE FROM agent_actions WHERE conversation_id=${r.conversationId};`);
  console.log(`  DELETE FROM agent_usage WHERE conversation_id=${r.conversationId};`);
  console.log(`  DELETE FROM agent_conversations WHERE id=${r.conversationId};`);
  process.exit(0);
})().catch((e) => {
  console.error('探针失败: ' + ((e && e.message) || e));
  process.exit(1);
});
