import { get, post, put, del } from '../utils/request'
import { uploadMedia } from '../utils/upload'

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

/**
 * 上传作业附件（docx / pdf / 图片 / zip ≤100MB）
 * 后端 POST /api/homework/upload，与班费凭证同一套 multer 配置
 */
export function uploadHomeworkAttachment(file: File): Promise<{ success: boolean; url: string; filename: string; size: number }> {
  // 统一媒体端点（kind=homework 允许图片/PDF/Office/zip）
  return uploadMedia(file, 'homework') as any
}

/** 列表分页参数（P1-3）：不传 = 后端返回全量，行为与分页前一致 */
export interface PagingParams {
  /** 第几页，最小 1 */
  page?: number
  /** 每页条数 1–100（超过按 100 处理） */
  pageSize?: number
}

/** 仅分页请求会返回的附加字段（homeworks 原样保留） */
export interface PageMeta {
  page?: number
  pageSize?: number
  total?: number
  hasMore?: boolean
}

/**
 * 作业列表
 *
 * 不传 paging = 全量（老客户端）；传了 page/pageSize 才走分页 SQL。
 */
export function getHomeworks(paging?: PagingParams): Promise<{ success: boolean; homeworks: HomeworkItem[] } & PageMeta> {
  return get('/api/homework', paging)
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

export function getPendingHomeworkCount(): Promise<{ success: boolean; count: number }> {
  return get('/api/homework/pending/count')
}
