import { get, post, put } from '@/utils/request'

export interface LotteryItem {
  id: number
  name: string
  description?: string
  rules: string
  creator_id: number
  creator_name?: string
  start_time: string
  end_time: string
  is_active: boolean | number
  participant_count?: number
  winner_count?: number
  created_at: string
  updated_at: string
}

export interface LotteryParticipant {
  id: number
  lottery_id: number
  user_id: number
  user_name?: string
  student_id?: string
  avatarUrl?: string
  is_winner: boolean | number
  prize?: string | null
  created_at: string
}

export interface MyLotteryRecord {
  id: number
  is_winner: boolean | number
  prize?: string | null
}

export function getLotteries(): Promise<{ success: boolean; lotteries: LotteryItem[] }> {
  return get('/api/lottery')
}

export function createLottery(params: {
  name: string
  description?: string
  rules: string
  start_time: string
  end_time: string
}): Promise<{ success: boolean; id: number }> {
  return post('/api/lottery', params)
}

export function getLotteryDetail(id: number): Promise<{
  success: boolean
  lottery: LotteryItem
  participants: LotteryParticipant[]
  myRecord?: MyLotteryRecord | null
}> {
  return get(`/api/lottery/${id}`)
}

export function joinLottery(id: number): Promise<{ success: boolean; id: number }> {
  return post(`/api/lottery/${id}/join`)
}

export function drawLottery(id: number, params: { winner_count: number; prize?: string }): Promise<{ success: boolean; winner_participant_ids: number[] }> {
  return post(`/api/lottery/${id}/draw`, params)
}

export function closeLottery(id: number): Promise<{ success: boolean }> {
  return put(`/api/lottery/${id}/close`)
}
