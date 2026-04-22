/**
 * App 版本检查 / 下载 / 安装
 *
 * 只在 App（plus 环境）下才会真正工作；其他平台直接 no-op。
 * 用法：
 *   import { checkAppUpdate } from '@/utils/update-checker'
 *   await checkAppUpdate({ silent: true })   // 启动时静默检查
 *   await checkAppUpdate({ silent: false })  // 用户手动点"检查更新"
 */

import { get } from './request'

declare const plus: any

export interface RemoteVersion {
  versionName: string
  versionCode: number
  minVersionCode?: number
  downloadUrl: string
  apkSize?: number
  releasedAt?: string
  forceUpdate?: boolean
  changelog?: string
}

export interface CheckOptions {
  /** 静默模式：没有新版本时不弹任何提示 */
  silent?: boolean
}

const IGNORE_VERSION_KEY = 'update_ignored_version'

/**
 * 获取当前 App 版本号（仅 App 平台可用）
 */
export function getCurrentAppVersion(): { versionName: string; versionCode: number } | null {
  // #ifdef APP-PLUS
  try {
    const widgetInfo = plus.runtime as { version: string; versionCode?: string | number }
    const versionCode = widgetInfo.versionCode
      ? Number(widgetInfo.versionCode)
      : parseVersionNameToCode(widgetInfo.version)
    return {
      versionName: widgetInfo.version || '1.0.0',
      versionCode: isNaN(versionCode) ? 100 : versionCode
    }
  } catch (e) {
    console.warn('[update-checker] 读取当前版本失败', e)
    return null
  }
  // #endif
  // #ifndef APP-PLUS
  return null
  // #endif
}

function parseVersionNameToCode(name: string): number {
  // "1.2.3" → 10203，跨平台版本号映射
  const parts = (name || '0.0.0').split('.').map(n => Number(n) || 0)
  while (parts.length < 3) parts.push(0)
  return parts[0] * 10000 + parts[1] * 100 + parts[2]
}

/**
 * 检查版本更新，按需弹框提示用户下载。
 *
 * 返回值：
 *   - 有新版本 → { hasUpdate: true, remote }
 *   - 无新版本 → { hasUpdate: false }
 *   - 非 App 平台 / 检查失败 → { hasUpdate: false, error }
 */
export async function checkAppUpdate(opts: CheckOptions = {}): Promise<{
  hasUpdate: boolean
  remote?: RemoteVersion
  error?: string
}> {
  const { silent = false } = opts

  // #ifndef APP-PLUS
  if (!silent) {
    uni.showToast({ title: '仅支持 Android App 更新检查', icon: 'none' })
  }
  return { hasUpdate: false, error: '非 App 平台' }
  // #endif

  // #ifdef APP-PLUS
  const current = getCurrentAppVersion()
  if (!current) {
    return { hasUpdate: false, error: '无法读取当前版本' }
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
    if (!silent) uni.showToast({ title: '检查更新失败', icon: 'none' })
    return { hasUpdate: false, error: e?.message || '网络错误' }
  }

  if (!remote?.versionCode || !remote.downloadUrl) {
    if (!silent) uni.showToast({ title: '暂无可用更新', icon: 'none' })
    return { hasUpdate: false }
  }

  if (remote.versionCode <= current.versionCode) {
    if (!silent) {
      uni.showToast({
        title: `已是最新版本 ${current.versionName}`,
        icon: 'success'
      })
    }
    return { hasUpdate: false }
  }

  // 用户手动忽略过该版本？静默模式下尊重用户选择
  const ignoredVersion = uni.getStorageSync(IGNORE_VERSION_KEY)
  const isForce =
    remote.forceUpdate === true ||
    (remote.minVersionCode !== undefined && current.versionCode < remote.minVersionCode)

  if (silent && ignoredVersion === remote.versionCode && !isForce) {
    return { hasUpdate: true, remote }
  }

  showUpdateDialog(current.versionName, remote, isForce)
  return { hasUpdate: true, remote }
  // #endif
}

// #ifdef APP-PLUS
function showUpdateDialog(currentVersion: string, remote: RemoteVersion, forceUpdate: boolean) {
  const sizeLabel =
    remote.apkSize && remote.apkSize > 0 ? `，约 ${(remote.apkSize / 1024 / 1024).toFixed(1)} MB` : ''
  const content =
    `当前版本：${currentVersion}\n` +
    `最新版本：${remote.versionName}${sizeLabel}\n\n` +
    `更新内容：\n${remote.changelog || '暂无说明'}`

  uni.showModal({
    title: forceUpdate ? '必须升级到最新版' : '发现新版本',
    content,
    confirmText: '立即更新',
    cancelText: forceUpdate ? '退出' : '稍后',
    showCancel: true,
    success: ({ confirm, cancel }) => {
      if (confirm) {
        startDownloadAndInstall(remote)
      } else if (cancel) {
        if (forceUpdate) {
          plus.runtime.quit()
        } else {
          uni.setStorageSync(IGNORE_VERSION_KEY, remote.versionCode)
        }
      }
    }
  })
}

function startDownloadAndInstall(remote: RemoteVersion) {
  uni.showLoading({ title: '开始下载...', mask: true })

  const downloadTask = plus.downloader.createDownload(
    remote.downloadUrl,
    { filename: `_doc/update/${remote.versionName}.apk` },
    (download: any, status: number) => {
      uni.hideLoading()
      if (status === 200) {
        plus.runtime.install(
          download.filename,
          { force: false },
          () => {
            uni.showToast({ title: '安装中...', icon: 'none' })
          },
          (err: any) => {
            console.error('安装失败', err)
            uni.showModal({
              title: '安装失败',
              content: err?.message || '请到文件管理器手动安装',
              showCancel: false
            })
          }
        )
      } else {
        uni.showModal({
          title: '下载失败',
          content: `错误码 ${status}，请稍后重试或从官网手动下载`,
          showCancel: false
        })
      }
    }
  )

  downloadTask.addEventListener('statechanged', (task: any) => {
    if (task.state === 3 && task.totalSize > 0) {
      const percent = Math.round((task.downloadedSize / task.totalSize) * 100)
      uni.showLoading({ title: `下载中 ${percent}%`, mask: true })
    }
  })

  downloadTask.start()
}
// #endif
