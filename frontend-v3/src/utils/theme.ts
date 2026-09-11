/**
 * 主题（浅色 / 暗色）工具
 *
 * 2026-09 修复（P1）：此前 data-theme 只在「设置」页恢复 ——
 * 用户在设置里开了暗色，冷启动 App 回到首页又是亮色，只有进一次设置页才生效。
 * 现在由 main.ts 启动时统一初始化。
 */

const THEME_KEY = 'theme'
export type ThemeName = 'light' | 'dark'

export function getStoredTheme(): ThemeName | null {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

/** 启动时调用：把上次选择（或系统偏好）应用到 documentElement */
export function initTheme() {
  const stored = getStoredTheme()
  const prefersDark = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  const theme: ThemeName = stored || (prefersDark ? 'dark' : 'light')
  applyTheme(theme, false)
  return theme
}

export function applyTheme(theme: ThemeName, persist = true) {
  document.documentElement.setAttribute('data-theme', theme)
  // 让浏览器原生控件（滚动条、输入框）跟随
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a1628' : '#1a3a5c')
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }
}

export function currentTheme(): ThemeName {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function toggleTheme(): ThemeName {
  const next: ThemeName = currentTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
