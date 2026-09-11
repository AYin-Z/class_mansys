/**
 * 区队相册 API
 */
import { get, post, del } from '../utils/request'

export interface AlbumItem {
  id: number
  name: string
  description?: string
  creator_id: number
  creator_name?: string
  permission: number
  photo_count: number
  /** 封面缩略图（服务端已改成 thumb，网格/头部直接用，不要用原图） */
  cover_url?: string | null
  /** 封面原图：只有"保存封面原图"这类场景才用 */
  cover_full_url?: string | null
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
  /** 原图（客户端已压缩，约 200KB–1MB）：仅在「保存原图」时下载 */
  url: string
  /** 480px 缩略图（约 20–60KB）：网格/列表必须用它 */
  thumb_url?: string | null
  /** 1440px 中图（约 200–400KB）：查看器用它做预览 */
  medium_url?: string | null
  width?: number | null
  height?: number | null
  size?: number | null
  mime?: string | null
  description?: string
  uploader_id: number
  uploader_name?: string
  is_approved: boolean
  approved_by?: number
  approved_at?: string
  created_at: string
  /** 仅待审核列表（LEFT JOIN albums）会带 */
  album_name?: string | null
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

/**
 * 旧的两段式上传（先传文件拿 URL、再提交 URL 列表）。
 *
 * ⚠️ 新代码请走统一端点：`uploadBatch(files, { kind: 'album', fields: { album_id } })`
 * （见 @/utils/upload，自带压缩/进度/重试）。这里保留是因为可能仍有调用方。
 */
export function uploadPhotos(params: PhotoUploadParams): Promise<{ success: boolean; auto_approved?: boolean }> {
  return post('/api/album/photos', params)
}

export function getPendingPhotos(): Promise<{ success: boolean; photos: PhotoItem[] }> {
  return get('/api/album/photos/pending')
}

export function approvePhoto(id: number): Promise<{ success: boolean }> {
  return post(`/api/album/photos/${id}/approve`)
}

/**
 * 删除照片：`DELETE /api/album/photos/:id`
 *
 * 同一个端点承担两件事（后端 AlbumController.rejectPhoto）：
 *  - 待审核照片 = 驳回（需 APPROVE_PHOTO）
 *  - 已通过照片 = 删除（相册创建者 / 上传者本人 / APPROVE_PHOTO 持有者）
 * 删除会连带清理磁盘原图与派生图。
 */
export function deletePhoto(id: number): Promise<{ success: boolean }> {
  return del(`/api/album/photos/${id}`)
}

/** 历史别名：与 deletePhoto 是同一个接口，保留以免其它文件 import 报错 */
export const rejectPhoto = deletePhoto
