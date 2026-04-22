/**
 * 区队相册 API
 */
import { get, post, del } from '@/utils/request'

export interface AlbumItem {
  id: number
  name: string
  description?: string
  creator_id: number
  creator_name?: string
  permission: number
  photo_count: number
  cover_url?: string | null
  created_at: string
  updated_at: string
}

export interface AlbumCreateParams {
  name: string
  description?: string
  permission?: number
}

export interface PhotoItem {
  id: number
  album_id: number
  url: string
  description?: string
  uploader_id: number
  uploader_name?: string
  is_approved: boolean
  approved_by?: number
  approved_at?: string
  created_at: string
}

export interface PhotoUploadParams {
  album_id: number
  urls: string[]
  description?: string
}

export function getAlbums(): Promise<{ success: boolean; albums: AlbumItem[] }> {
  return get('/api/album')
}

export function createAlbum(params: AlbumCreateParams): Promise<{ success: boolean; id: number }> {
  return post('/api/album', params)
}

export function getAlbumDetail(id: number): Promise<{ success: boolean; album: AlbumItem; photos: PhotoItem[] }> {
  return get(`/api/album/${id}`)
}

export function deleteAlbum(id: number): Promise<{ success: boolean }> {
  return del(`/api/album/${id}`)
}

export function uploadPhotos(params: PhotoUploadParams): Promise<{ success: boolean; auto_approved?: boolean }> {
  return post('/api/album/photos', params)
}

export function getPendingPhotos(): Promise<{ success: boolean; photos: PhotoItem[] }> {
  return get('/api/album/photos/pending')
}

export function approvePhoto(id: number): Promise<{ success: boolean }> {
  return post(`/api/album/photos/${id}/approve`)
}

export function rejectPhoto(id: number): Promise<{ success: boolean }> {
  return del(`/api/album/photos/${id}`)
}
