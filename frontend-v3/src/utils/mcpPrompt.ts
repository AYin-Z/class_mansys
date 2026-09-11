/**
 * MCP 接入文案生成器（页面与用户手册共用）
 *
 * 设计前提：MCP 是协议、不是软件包——用户不需要"下载 MCP"。
 * HTTP 方式只要把「地址 + 令牌」填进已有 AI 客户端的 MCP 配置即可；
 * 若客户端只支持 stdio，则用 mcp-remote 之类的一次性桥接命令。
 * 因此这里提供「复制给 AI 的提示词」，让用户自己的 agent 去完成配置与自检。
 */
export interface McpAgentPromptOptions {
  endpoint: string
  token: string
  allowWrite: boolean
  toolCount?: number
}

export function maskToken(token: string): string {
  if (!token) return 'cm_你的令牌'
  return token.length <= 12 ? token : token.slice(0, 10) + '…' + token.slice(-4)
}

export function buildMcpConfigJson(endpoint: string, token: string): string {
  return JSON.stringify(
    { mcpServers: { 'class-mansys': { url: endpoint, headers: { Authorization: 'Bearer ' + (token || 'cm_你的令牌') } } } },
    null,
    2,
  )
}

export function buildMcpStdioConfig(token: string, serverPath = '<你的部署目录>/backend/mcp/server.js'): string {
  return JSON.stringify(
    { mcpServers: { 'class-mansys': { command: 'node', args: [serverPath], env: { CM_API_TOKEN: token || 'cm_你的令牌' } } } },
    null,
    2,
  )
}

export function buildMcpBridgeCommand(endpoint: string, token: string): string {
  return 'npx -y mcp-remote ' + endpoint + ' --header "Authorization: Bearer ' + (token || 'cm_你的令牌') + '"'
}

/** 一键复制给用户自己的 AI agent：让它自己完成配置、验证并回贴配置片段 */
export function buildMcpAgentPrompt(o: McpAgentPromptOptions): string {
  const scope = o.allowWrite
    ? '读写（可以提交请假、报销、建议、审批等，但每次都必须在会话里得到我的确认才会落库）'
    : '只读（只能查询：请假、考勤、班费、通知、作业、积分等）'
  const tools = o.toolCount ? '\n- 该令牌可用工具数：' + o.toolCount : ''
  return [
    '帮我把我所在区队管理系统的 MCP 服务接入到你（当前这个 AI 客户端）里，然后验证一次连通性。',
    '',
    '【服务信息】',
    '- 名称：class-mansys（区队/中队管理系统）',
    '- MCP 端点：' + o.endpoint,
    '- 认证头：Authorization: Bearer ' + (o.token || 'cm_你的令牌'),
    '- 协议：MCP Streamable HTTP（无状态；不支持 SSE 订阅与会话删除，GET/DELETE 会返回 405）',
    '- 我的令牌权限：' + scope + tools,
    '',
    '【请你按顺序完成】',
    '1. 找到你当前客户端的 MCP 配置文件位置（Claude Desktop：macOS ~/Library/Application Support/Claude/claude_desktop_config.json，Windows %APPDATA%\\Claude\\claude_desktop_config.json；Cursor：项目内 .cursor/mcp.json 或全局 MCP 设置；其他客户端查它自己的 MCP 文档），不要凭猜测覆盖无关配置。',
    '2. 写入一个名为 class-mansys 的 server：优先用 HTTP 形式（url + headers.Authorization）。',
    '3. 如果你的客户端只支持 stdio，请改用桥接命令：' + buildMcpBridgeCommand(o.endpoint, o.token) + '（首次运行会通过 npx 自动下载桥接器，无需我手动安装）。',
    '4. 配置完成后：调用 tools/list 确认连接成功；再调用 cm_my_leaves 验证能读到我的请假数据；如果我的令牌是只读的，就不要尝试任何写工具。',
    '5. 把「你实际写入的配置片段」和「验证结果」原样贴给我；如果失败，给出你看到的错误码与你的处理建议。',
    '',
    '【注意事项】',
    '- 这是长期有效的个人凭证，等同于我的身份：不要写入任何公开仓库、不要上传到第三方、不要贴进公开聊天。',
    '- 只做只读验证，不要修改系统里的任何数据。',
    '- 遇到 401 说明令牌错误或已被吊销；遇到 406 说明客户端过老（缺少 Accept: application/json, text/event-stream）。',
  ].join('\n')
}
