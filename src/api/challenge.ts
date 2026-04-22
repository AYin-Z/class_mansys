import { get, post, put } from '@/utils/request'

export interface ChallengeItem {
  id: number
  name: string
  type: string
  description: string
  current_champion_id?: number | null
  champion_name?: string | null
  champion_student_id?: string | null
  record_count?: number
  created_at: string
  updated_at: string
}

export interface ChallengeApplication {
  id: number
  challenge_id: number
  challenge_name?: string
  challenge_type?: string
  user_id: number
  user_name?: string
  student_id?: string
  status: number  // 0=待审 1=通过 2=拒绝
  approver_id?: number | null
  approval_time?: string | null
  created_at: string
}

export interface ChallengeRecord {
  id: number
  challenge_id: number
  challenger_id: number
  challenger_name?: string
  champion_id: number
  champion_name?: string
  result: string
  notes?: string
  created_at: string
}

export const CHALLENGE_APP_STATUS_LABEL: Record<number, string> = {
  0: '待审批',
  1: '已通过',
  2: '已拒绝'
}

export function getChallenges(): Promise<{ success: boolean; challenges: ChallengeItem[] }> {
  return get('/api/challenge')
}

export function createChallenge(params: { name: string; type: string; description: string }): Promise<{ success: boolean; id: number }> {
  return post('/api/challenge', params)
}

export function getChallengeDetail(id: number): Promise<{
  success: boolean
  challenge: ChallengeItem
  records: ChallengeRecord[]
  applications: ChallengeApplication[]
}> {
  return get(`/api/challenge/${id}`)
}

export function applyChallenge(id: number): Promise<{ success: boolean; id: number; message: string }> {
  return post(`/api/challenge/${id}/apply`)
}

export function getMyChallengeApplications(): Promise<{ success: boolean; applications: ChallengeApplication[] }> {
  return get('/api/challenge/my-applications')
}

export function approveChallengeApplication(applicationId: number, status: 1 | 2): Promise<{ success: boolean }> {
  return put(`/api/challenge/application/${applicationId}/approve`, { status })
}

export function recordChallenge(id: number, params: { challenger_id: number; champion_id: number; result: string; notes?: string }): Promise<{ success: boolean; id: number }> {
  return post(`/api/challenge/${id}/record`, params)
}
