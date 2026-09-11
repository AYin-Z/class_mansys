import { get, post, del, apiUrl } from '../utils/request'
import { uploadMedia } from '../utils/upload'

export interface AgentMessage {
  id?: number
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export interface AgentPendingAction {
  id: number
  tool: string
  label: string
  preview: string
}

export interface AgentAttachment {
  url: string
  name?: string
  mime?: string
  size?: number
  isImage?: boolean
}

export interface AgentChatResult {
  success: boolean
  conversationId: number
  reply: string
  pendingAction?: AgentPendingAction | null
}

export interface AgentToolModule {
  name: string
  label: string
  description: string
  actions: string[]
}

export interface AgentToolsResult {
  success: boolean
  data: {
    routeCount: number
    modules: AgentToolModule[]
    curated: { name: string; label: string; description: string; write: boolean }[]
  }
}

export function getAgentTools(): Promise<AgentToolsResult> {
  return get('/api/agent/tools')
}

export function agentChat(message: string, conversationId?: number, attachments?: AgentAttachment[]): Promise<AgentChatResult> {
  return post('/api/agent/chat', { message, conversationId, attachments })
}

/** 上传对话附件（图片），返回可直接放进消息的 url */
export function uploadAgentAttachment(file: File): Promise<{ success: boolean; url: string; name: string; mime: string; size: number }> {
  // 统一媒体端点（kind=agent 仅图片，客户端会先压缩）
  return uploadMedia(file, 'agent') as any
}

export function agentConfirm(actionId: number): Promise<{ success: boolean; reply: string; successFlag?: boolean }> {
  return post('/api/agent/confirm', { actionId })
}

export function getAgentConversations(): Promise<{ success: boolean; conversations: { id: number; title: string; updated_at: string }[] }> {
  return get('/api/agent/conversations')
}

export function getAgentMessages(conversationId: number): Promise<{ success: boolean; messages: AgentMessage[] }> {
  return get('/api/agent/conversations/' + conversationId + '/messages')
}

export interface AgentApiToken {
  id: number
  name: string | null
  prefix: string
  allow_write?: number | boolean
  last_used_at?: string | null
  revoked_at?: string | null
  created_at: string
}

export interface CreatedApiToken {
  token: string
  prefix: string
  allowWrite: boolean
}

/** 生成 MCP 令牌（明文仅此一次返回） */
export async function createApiToken(name: string, allowWrite = false): Promise<CreatedApiToken> {
  const res = await post<{ data: CreatedApiToken }>('/api/agent/tokens', { name, allowWrite })
  return res.data
}

export async function listApiTokens(): Promise<AgentApiToken[]> {
  const res = await get<{ tokens: AgentApiToken[] }>('/api/agent/tokens')
  return res.tokens || []
}

export async function revokeApiToken(id: number): Promise<void> {
  await del('/api/agent/tokens/' + id)
}

export interface WechatBinding {
  id: number
  channel: string
  external_id: string
  display_name?: string | null
  status?: string
  created_at: string
}

export interface BindCode {
  code: string
  expiresInSec: number
}

/** 生成微信绑定码（15 分钟一次性） */
export async function issueBindCode(): Promise<BindCode> {
  const res = await post<{ data: BindCode }>('/api/agent/channel/bind-code', {})
  return res.data
}

export async function listBindings(): Promise<WechatBinding[]> {
  const res = await get<{ bindings: WechatBinding[] }>('/api/agent/channel/bindings')
  return res.bindings || []
}

export async function unbindWechat(id: number): Promise<void> {
  await del('/api/agent/channel/bindings/' + id)
}

export interface WechatBotStatus {
  connected: boolean
  accountId: string | null
  baseUrl: string | null
  credentialsFile?: string
  worker?: string
  status?: 'wait' | 'scaned' | 'expired' | 'confirmed' | 'none'
  qrDataUrl?: string
  expiresInSec?: number
}

/** 机器人身份连接状态（含 worker 是否在跑） */
export async function getBotLogin(): Promise<WechatBotStatus> {
  const res = await get<{ data: WechatBotStatus }>('/api/agent/channel/bot-login')
  return res.data
}

/** 生成扫码二维码 */
export async function startBotLogin(): Promise<WechatBotStatus> {
  const res = await post<{ data: WechatBotStatus }>('/api/agent/channel/bot-login/start', {})
  return res.data
}

/** 轮询扫码状态 */
export async function pollBotLogin(): Promise<WechatBotStatus> {
  const res = await get<{ data: WechatBotStatus }>('/api/agent/channel/bot-login/status')
  return res.data
}

export interface McpSelfCheck {
  user?: { id: number; name: string; role: number }
  allowWrite: boolean
  toolCount: number
  endpoint: string
  tools: string[]
}

/** 用令牌自检 MCP 通道（工具数 / 是否可写），不需要 AI 客户端即可验证 */
export async function mcpSelfCheck(token: string): Promise<McpSelfCheck> {
  const res = await fetch(apiUrl('/api/mcp/info'), { headers: { Authorization: 'Bearer ' + token } })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.success === false) {
    throw new Error((body && body.error) || '连接失败（HTTP ' + res.status + '）')
  }
  return body.data as McpSelfCheck
}
