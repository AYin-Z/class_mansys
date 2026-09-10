import { get, post, del, uploadFile, apiUrl } from '../utils/request'

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
  return uploadFile('/api/agent/upload', file)
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

export function listApiTokens(): Promise<{ success: boolean; tokens: AgentApiToken[] }> {
  return get('/api/agent/tokens')
}

export function createApiToken(name: string, allowWrite = false): Promise<{ success: boolean; data: { token: string; prefix: string; allowWrite: boolean }; message?: string }> {
  return post('/api/agent/tokens', { name, allowWrite })
}

/** 用令牌自检 MCP 通道（工具数 / 是否可写），不需要 AI 客户端即可验证 */
export async function mcpSelfCheck(token: string): Promise<{ success: boolean; data?: { user?: { name?: string }; toolCount?: number; allowWrite?: boolean }; error?: string }> {
  const res = await fetch(apiUrl('/api/mcp/info'), { headers: { Authorization: 'Bearer ' + token } })
  return res.json().catch(() => ({ success: false, error: '解析响应失败' }))
}

export function revokeApiToken(id: number): Promise<{ success: boolean; message?: string }> {
  return del('/api/agent/tokens/' + id)
}

export interface WechatBinding {
  id: number
  channel: string
  external_id: string
  display_name?: string | null
  status?: string
  created_at: string
}

export function issueBindCode(): Promise<{ success: boolean; code: string; expiresInSec: number }> {
  return post('/api/agent/channel/bind-code', {})
}

export function listBindings(): Promise<{ success: boolean; bindings: WechatBinding[] }> {
  return get('/api/agent/channel/bindings')
}

export function unbindWechat(id: number): Promise<{ success: boolean; message?: string }> {
  return del('/api/agent/channel/bindings/' + id)
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

export function getBotLogin(): Promise<{ success: boolean; data: WechatBotStatus }> {
  return get('/api/agent/channel/bot-login')
}

export function startBotLogin(): Promise<{ success: boolean; data: WechatBotStatus }> {
  return post('/api/agent/channel/bot-login/start', {})
}

export function pollBotLogin(): Promise<{ success: boolean; data: WechatBotStatus }> {
  return get('/api/agent/channel/bot-login/status')
}
