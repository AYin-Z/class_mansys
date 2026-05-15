interface SystemInfo {
  statusBarHeight: number
  navBarHeight: number
  safeAreaBottom: number
  screenWidth: number
  screenHeight: number
}

/**
import { ref, onMounted } from 'vue'

function getSystemInfoSync() {
  return {
    statusBarHeight: window.innerHeight > 0 ? 20 : 0,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    safeArea: null,
    safeAreaInsets: { bottom: 0 },
  }
}
 * 获取设备系统信息（状态栏高度、安全区、屏幕尺寸等）。
 * 提取 nav-bar 和 tab-bar 的公共逻辑，消除重复 `getSystemInfoSync` 调用。
 */
export function useSystemInfo() {
  const statusBarHeight = ref(20)
  const navBarHeight = ref(44)
  const safeAreaBottom = ref(0)
  const screenWidth = ref(375)
  const screenHeight = ref(812)

  onMounted(() => {
    try {
      const info = getSystemInfoSync()
      statusBarHeight.value = info.statusBarHeight || 20
      screenWidth.value = info.screenWidth || 375
      screenHeight.value = info.screenHeight || 812

      // safeArea 安全区
      if (info.safeAreaInsets?.bottom !== undefined) {
        safeAreaBottom.value = info.safeAreaInsets.bottom
      } else if (info.safeArea) {
        safeAreaBottom.value = Math.max(0, info.screenHeight - (info.safeArea.bottom || info.screenHeight))
      }
    } catch (e) {
      console.warn('[useSystemInfo] getSystemInfoSync failed:', e)
    }
  })

  return {
    statusBarHeight,
    navBarHeight,
    safeAreaBottom,
    screenWidth,
    screenHeight,
  } as SystemInfo
}
