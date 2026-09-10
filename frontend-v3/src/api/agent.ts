import { get, post, del } from '../utils/request'

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

export function agentChat(message: string, conversationId?: number): Promise<AgentChatResult> {
  return post('/api/agent/chat', { message, conversationId })
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
  last_used_at?: string | null
  revoked_at?: string | null
  created_at: string
}

export function listApiTokens(): Promise<{ success: boolean; tokens: AgentApiToken[] }> {
  return get('/api/agent/tokens')
}

export function createApiToken(name: string): Promise<{ success: boolean; token: string; prefix: string; message?: string }> {
  return post('/api/agent/tokens', { name })
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
