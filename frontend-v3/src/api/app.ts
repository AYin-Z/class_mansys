/**
 * 客户端版本更新 API
 */
import { get } from '../utils/request'

export interface AppVersion {
  versionName: string
  versionCode: number
  minVersionCode: number
  downloadUrl: string
  apkSize: number
  releasedAt: string
  forceUpdate: boolean
  changelog: string
}

export function getLatestVersion(): Promise<{ success: boolean; data: AppVersion }> {
  return get('/api/app/latest')
}
