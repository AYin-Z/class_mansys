/**
 * 公告 + 资源共享 API
 */
import { get, post, del } from '@/utils/request'

export interface AnnouncementItem {
  id: number
  title: string
  content: string
  creator_id: number
  creator_name?: string
  created_at: string
  updated_at: string
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
