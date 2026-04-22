/**
 * 投票 API
 */
import { get, post } from '@/utils/request'

export interface VoteOption {
  id: number
  vote_id: number
  content: string
  vote_count: number
  rate?: number
}

export interface VoteItem {
  id: number
  title: string
  description?: string
  type: string                // 'single' | 'multiple' | '单选' | '多选'
  creator_id: number
  creator_name?: string
  start_time: string
  end_time: string
  is_active: boolean
  participant_count?: number
  created_at: string
}

export interface VoteCreateParams {
  title: string
  description?: string
  type: 'single' | 'multiple'
  start_time: string
  end_time: string
  options: string[]
}

export interface VoteDetail {
  vote: VoteItem
  options: VoteOption[]
  my_choices: number[]
  total_votes: number
}

export function isVoteSingle(v: Pick<VoteItem, 'type'>): boolean {
  return v.type === 'single' || v.type === '单选'
}

export function getVoteStatus(v: VoteItem): 'pending' | 'active' | 'ended' {
  const now = Date.now()
  if (!v.is_active) return 'ended'
  if (now < new Date(v.start_time).getTime()) return 'pending'
  if (now > new Date(v.end_time).getTime()) return 'ended'
  return 'active'
}

export function getVotes(): Promise<{ success: boolean; votes: VoteItem[] }> {
  return get('/api/vote')
}

export function getVoteDetail(id: number): Promise<{ success: boolean } & VoteDetail> {
  return get(`/api/vote/${id}`)
}

export function createVote(params: VoteCreateParams): Promise<{ success: boolean; id: number }> {
  return post('/api/vote', params)
}

export function castVote(id: number, optionIds: number[]): Promise<{ success: boolean }> {
  return post(`/api/vote/${id}/cast`, { option_ids: optionIds })
}

export function closeVote(id: number): Promise<{ success: boolean }> {
  return post(`/api/vote/${id}/close`)
}
