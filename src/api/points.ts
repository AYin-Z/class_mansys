import { get, post } from '@/utils/request'

export interface PointRecord {
  id: number
  user_id: number
  user_name?: string
  student_id?: string
  score: number
  reason: string
  created_by: number
  creator_name?: string
  created_at: string
}

export interface RankingItem {
  id: number
  name: string
  student_id: string
  class_id: string
  avatarUrl: string
  total_score: number
  records: number
}

export function getMyPoints(): Promise<{ success: boolean; records: PointRecord[]; total: number }> {
  return get('/api/points/mine')
}

export function getPointsRanking(limit = 50): Promise<{ success: boolean; ranking: RankingItem[] }> {
  return get('/api/points/ranking', { limit })
}

export function getAllPoints(): Promise<{ success: boolean; records: PointRecord[] }> {
  return get('/api/points/all')
}

export function addPointRecord(params: { user_id: number; score: number; reason: string }): Promise<{ success: boolean; id: number }> {
  return post('/api/points', params)
}
