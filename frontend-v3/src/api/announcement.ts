/**
 * 公告 + 资源共享 API
 */
import { get, post, put, del } from '../utils/request'

export interface AnnouncementItem {
  id: number
  title: string
  content: string
  creator_id: number
  creator_name?: string
  is_pinned?: number | boolean
  created_at: string
  updated_at: string
  /** 修订次数（列表接口返回） */
  revision_count?: number
}

/** 公告修订记录（不含正文，正文按需单独取） */
export interface AnnouncementRevision {
  id: number
  announcement_id: number
  version: number
  title: string
  is_pinned: number | boolean
  /** publish=首次发布 edit=编辑 revert=回退 */
  source: 'publish' | 'edit' | 'revert' | string
  editor_id?: number | null
  editor_name?: string | null
  content_length?: number
  created_at: string
}

export interface AnnouncementCreateParams {
  title: string
  content: string
}

export interface ResourceItem {
  id: number
  name: string
  type: string
  url: string
  size: number
  uploader_id: number
  uploader_name?: string
  category: string
  description?: string
  created_at: string
}

export interface ResourceCreateParams {
  name: string
  type: string
  url: string
  size: number
  category: string
  description?: string
}

export function getAnnouncements(): Promise<{ success: boolean; announcements: AnnouncementItem[] }> {
  return get('/api/announcement')
}

export function getAnnouncementDetail(id: number): Promise<{ success: boolean; announcement: AnnouncementItem }> {
  return get(`/api/announcement/${id}`)
}

export function createAnnouncement(params: AnnouncementCreateParams): Promise<{ success: boolean; id: number }> {
  return post('/api/announcement/create', params)
}

/**
 * 编辑公告（超管或发布者本人）
 * 每次编辑都会生成新版本，可在「修改记录」里查看与回退
 */
export function updateAnnouncement(
  id: number,
  patch: { title?: string; content?: string; is_pinned?: boolean },
): Promise<{ success: boolean; version: number; message?: string }> {
  return put(`/api/announcement/${id}`, patch)
}

export function getAnnouncementRevisions(id: number): Promise<{
  success: boolean
  revisions: AnnouncementRevision[]
  currentVersion: number
}> {
  return get(`/api/announcement/${id}/revisions`)
}

export function getAnnouncementRevision(id: number, version: number): Promise<{ success: boolean; revision: AnnouncementRevision & { content: string } }> {
  return get(`/api/announcement/${id}/revisions/${version}`)
}

/** 回退到历史版本：会生成一个新版本，历史不丢 */
export function revertAnnouncement(id: number, version: number): Promise<{ success: boolean; version: number; revertedFrom: number; message?: string }> {
  return post(`/api/announcement/${id}/revert/${version}`)
}

export function deleteAnnouncement(id: number): Promise<{ success: boolean }> {
  return del(`/api/announcement/${id}`)
}

export function getResources(category?: string): Promise<{ success: boolean; resources: ResourceItem[] }> {
  return get('/api/announcement/resources', category ? { category } : undefined)
}

export function createResource(params: ResourceCreateParams): Promise<{ success: boolean; id: number }> {
  return post('/api/announcement/resources', params)
}

export function deleteResource(id: number): Promise<{ success: boolean }> {
  return del(`/api/announcement/resources/${id}`)
}
