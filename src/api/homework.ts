import { get, post, put, del } from '@/utils/request'

export interface HomeworkItem {
  id: number
  title: string
  description: string
  creator_id: number
  creator_name?: string
  deadline: string
  submission_count?: number
  attachments?: AttachmentItem[] | null
  created_at: string
  updated_at: string
}

export interface AttachmentItem {
  name: string
  url: string
  size: number
  type: string
}

export interface HomeworkSubmission {
  id: number
  homework_id: number
  user_id: number
  user_name?: string
  student_id?: string
  file_url: string
  file_name: string
  status: number      // 0=待批改 1=已批改
  score?: number | null
  feedback?: string | null
  submitted_at: string
}

export interface HomeworkCreateParams {
  title: string
  description: string
  deadline: string
  attachments?: AttachmentItem[]
}

export interface HomeworkSubmitParams {
  file_url: string
  file_name: string
}

export interface HomeworkGradeParams {
  score: number
  feedback?: string
}

export function getHomeworks(): Promise<{ success: boolean; homeworks: HomeworkItem[] }> {
  return get('/api/homework')
}

export function createHomework(params: HomeworkCreateParams): Promise<{ success: boolean; id: number }> {
  return post('/api/homework', params)
}

export function getHomeworkDetail(id: number): Promise<{
  success: boolean
  homework: HomeworkItem
  mySubmission?: HomeworkSubmission | null
  submissions?: HomeworkSubmission[]
}> {
  return get(`/api/homework/${id}`)
}

export function deleteHomework(id: number): Promise<{ success: boolean }> {
  return del(`/api/homework/${id}`)
}

export function submitHomework(id: number, params: HomeworkSubmitParams): Promise<{ success: boolean; id: number }> {
  return post(`/api/homework/${id}/submit`, params)
}

export function gradeSubmission(submissionId: number, params: HomeworkGradeParams): Promise<{ success: boolean }> {
  return put(`/api/homework/submission/${submissionId}/grade`, params)
}
