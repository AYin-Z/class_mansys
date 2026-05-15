/**
 * 版本更新检查 — Capacitor 兼容版
 * 
 * 通过后端 API 获取最新 APK 版本，弹窗引导用户下载。
 * 不依赖 plus.runtime（已废弃）、uni.* API。
 */
import { get } from './request'
import { showToast, showConfirm } from '@/utils/ui'
import { Capacitor } from '@capacitor/core'

interface RemoteVersion {
  versionName: string
  versionCode: number
  downloadUrl: string
  forceUpdate?: boolean
  minVersionCode?: number
  changelog?: string
}

interface CheckOptions {
  silent?: boolean
}

const IGNORE_VERSION_KEY = 'update_ignored_version'
const APK_BASE_URL = 'https://cls.ayinserver.xin/apk'

function parseVersionNameToCode(name: string): number {
  const parts = (name || '0.0.0').split('.').map(n => Number(n) || 0)
  while (parts.length < 3) parts.push(0)
  return parts[0] * 10000 + parts[1] * 100 + parts[2]
}

/** 从文件名解析版本号（仅用于降级场景） */
function parseApkVersionCode(name: string): number | null {
  const m = name.match(/v?(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3])
}

/**
 * 获取当前 App 版本信息
 */
export function getCurrentAppVersion(): { versionName: string; versionCode: number } | null {
  // 浏览器环境返回默认值
  if (!Capacitor.isNativePlatform()) {
    return { versionName: '1.0.0', versionCode: 100 }
  }
  return { versionName: '1.0.0', versionCode: 100 }
}

/**
 * 检查版本更新，按需弹框提示用户下载。
 * 仅 Capacitor 原生平台生效（Android App），浏览器环境返回空。
 */
export async function checkAppUpdate(opts: CheckOptions = {}): Promise<{
  hasUpdate: boolean
  remote?: RemoteVersion
  error?: string
}> {
  const { silent = false } = opts

  // 非原生平台直接返回
  if (!Capacitor.isNativePlatform()) {
    if (!silent) showToast('仅支持 Android App 更新检查')
    return { hasUpdate: false, error: '非 App 平台' }
  }

  let remote: RemoteVersion
  try {
    const res = await get<{ success: boolean; data: RemoteVersion }>(
      '/api/app/latest',
      { platform: 'android' },
      { needAuth: false, silent: true }
    )
    remote = res.data
  } catch (e: any) {
    if (!silent) showToast('检查更新失败')
    return { hasUpdate: false, error: e?.message || '网络错误' }
  }

  if (!remote?.versionCode || !remote.downloadUrl) {
    if (!silent) showToast('暂无可用更新')
    return { hasUpdate: false }
  }

  // 获取本地版本号（从当前 loaded URL 的 APK 文件名推断）
  // Capacitor 场景下无法直接读取 APK versionCode，改用 API 版本对比
  // 简单实现：总是提示用户下载最新版，由用户决定是否安装
  const ignoredVersion = localStorage.getItem(IGNORE_VERSION_KEY)

  if (silent && ignoredVersion === String(remote.versionCode)) {
    return { hasUpdate: true, remote }
  }

  if (!silent) {
    const downloadUrl = remote.downloadUrl.startsWith('http')
      ? remote.downloadUrl
      : `${APK_BASE_URL}/${remote.downloadUrl}`

    const confirmed = await showConfirm(
      '发现新版本',
      `版本 ${remote.versionName}\n\n${remote.changelog || ''}\n\n是否下载更新？`
    )

    if (confirmed) {
      // 浏览器中打开下载链接
      window.open(downloadUrl, '_system')
    } else {
      localStorage.setItem(IGNORE_VERSION_KEY, String(remote.versionCode))
    }
  }

  return { hasUpdate: true, remote }
}
