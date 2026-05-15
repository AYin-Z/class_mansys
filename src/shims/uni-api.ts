/**
 * uni.* API 适配层 — 纯 DOM 实现
 *
 * 挂载到 window.uni，使 390+ 处 uni.* 调用在 H5 环境正常工作。
 * 支持所有 23 种被项目使用的 API 类型。
 *
 * 注意：文件操作（chooseImage/uploadFile）需要用户交互，
 *       navigateTo/reLaunch 依赖 vue-router 实例。
 */
import router from '@/router'

/* ======================== Event Bus ======================== */
type EventHandler = (...args: any[]) => void
const _eventBus = new Map<string, Set<EventHandler>>()

function $on(event: string, handler: EventHandler) {
  if (!_eventBus.has(event)) _eventBus.set(event, new Set())
  _eventBus.get(event)!.add(handler)
}
function $off(event: string, handler?: EventHandler) {
  if (!handler) { _eventBus.delete(event); return }
  const handlers = _eventBus.get(event)
  if (handlers) handlers.delete(handler)
}
function $emit(event: string, ...args: any[]) {
  _eventBus.get(event)?.forEach(h => h(...args))
}

/* ======================== Storage ======================== */
function getStorageSync(key: string): any {
  try { return JSON.parse(localStorage.getItem(key) || 'null') }
  catch { return localStorage.getItem(key) }
}
function setStorageSync(key: string, value: any) {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}
function removeStorageSync(key: string) {
  localStorage.removeItem(key)
}

/* ======================== Native Plugin ======================== */
function requireNativePlugin(_name: string): any {
  // uni-ui components call this in H5 — return a stub animation plugin
  return {
    createAnimation(_opts?: any) { return { step() {}, export() { return {} } } },
  }
}

/* ======================== Animation ======================== */
function createAnimation(_opts?: any): any {
  // uni.createAnimation — uni-ui components call this directly
  const anim: any = {}
  anim.bottom = (_v: number) => anim
  anim.top = (_v: number) => anim
  anim.left = (_v: number) => anim
  anim.right = (_v: number) => anim
  anim.width = (_v: number) => anim
  anim.height = (_v: number) => anim
  anim.opacity = (_v: number) => anim
  anim.rotate = (_v: number) => anim
  anim.scale = (_v: number) => anim
  anim.translate = (_x: number, _y: number) => anim
  anim.translateX = (_v: number) => anim
  anim.translateY = (_v: number) => anim
  anim.skew = (_x: number, _y: number) => anim
  anim.step = () => {}
  anim.export = () => ({})
  return anim
}

/* ======================== System Info ======================== */
function getDeviceInfo(): any {
  return {
    platform: 'web',
    brand: navigator.userAgent.match(/Chrome\//) ? 'chrome' : 'web',
    model: navigator.userAgent,
    system: navigator.platform,
    deviceId: 'h5-device',
    deviceType: 'web',
    deviceModel: navigator.userAgent,
  }
}
function getSystemInfoSync(): UniApp.GetSystemInfoResult {
  return {
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    pixelRatio: window.devicePixelRatio,
    platform: navigator.platform.toLowerCase(),
    language: navigator.language,
    model: navigator.userAgent,
    brand: '',
    system: navigator.platform,
    SDKVersion: '',
    safeArea: { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 },
    statusBarHeight: 0,
  }
}
function getSystemInfo(): Promise<UniApp.GetSystemInfoResult> {
  return Promise.resolve(getSystemInfoSync())
}

/* ======================== Base64 ======================== */
function base64ToArrayBuffer(str: string): ArrayBuffer {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/* ======================== Toast / Modal / Loading ======================== */
let _toastTimer: ReturnType<typeof setTimeout> | null = null
let _loadingEl: HTMLElement | null = null

function showToast(opts: string | { title: string; icon?: string; duration?: number; mask?: boolean }) {
  const title = typeof opts === 'string' ? opts : opts.title
  const icon = typeof opts === 'string' ? 'none' : (opts.icon || 'none')
  const duration = typeof opts === 'string' ? 1500 : (opts.duration || 1500)

  if (_toastTimer) { clearTimeout(_toastTimer); _removeToast() }

  const el = document.createElement('div')
  el.id = '__uni_toast'
  const iconMap: Record<string, string> = {
    success: '✓', error: '✕', fail: '✕', loading: '○',
  }
  const iconChar = iconMap[icon] || ''
  const isDark = icon === 'error' || icon === 'fail'

  el.style.cssText = `
    position:fixed; left:50%; top:40%; transform:translate(-50%,-50%);
    background:rgba(0,0,0,0.78); color:#fff; padding:18px 28px;
    border-radius:12px; font-size:15px; line-height:1.5;
    z-index:99999; text-align:center; pointer-events:none;
    max-width:80vw; backdrop-filter:blur(4px);
    animation:__uniToastFadeIn 0.2s ease-out;
  `
  if (iconChar) {
    el.innerHTML = `<div style="font-size:36px;margin-bottom:8px">${iconChar}</div><div>${title}</div>`
  } else {
    el.textContent = title
  }
  document.body.appendChild(el)

  _toastTimer = setTimeout(_removeToast, duration)
}

function _removeToast() {
  const el = document.getElementById('__uni_toast')
  if (el) el.remove()
  _toastTimer = null
}

// Inject toast animation
const _styleSheet = document.createElement('style')
_styleSheet.textContent = `
  @keyframes __uniToastFadeIn {
    from { opacity:0; transform:translate(-50%,-50%) scale(0.9); }
    to { opacity:1; transform:translate(-50%,-50%) scale(1); }
  }
`
document.head?.appendChild?.(_styleSheet)

function showLoading(opts: string | { title?: string; mask?: boolean }) {
  const title = typeof opts === 'string' ? opts : (opts.title || '加载中...')
  hideLoading()

  const el = document.createElement('div')
  el.id = '__uni_loading'
  el.style.cssText = `
    position:fixed; left:0; top:0; width:100%; height:100%;
    display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,0.3); z-index:99998;
  `
  el.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:28px 36px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.15)">
      <div style="width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#409EFF;border-radius:50%;margin:0 auto 12px;animation:__uniLoadingSpin 0.8s linear infinite"></div>
      <div style="font-size:15px;color:#333">${title}</div>
    </div>
  `
  document.body.appendChild(el)
  _loadingEl = el
}

function hideLoading() {
  if (_loadingEl) { _loadingEl.remove(); _loadingEl = null }
}

// Inject spin animation
const _spinStyle = document.createElement('style')
_spinStyle.textContent = `@keyframes __uniLoadingSpin { to { transform:rotate(360deg); } }`
document.head?.appendChild?.(_spinStyle)

function showModal(opts: {
  title?: string; content?: string; showCancel?: boolean; cancelText?: string; confirmText?: string
  editable?: boolean; placeholderText?: string
}): Promise<{ confirm: boolean; cancel: boolean; content?: string }> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed; left:0; top:0; width:100%; height:100%;
      display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.4); z-index:99997; backdrop-filter:blur(2px);
    `
    const dialog = document.createElement('div')
    dialog.style.cssText = `
      background:#fff; border-radius:14px; min-width:280px; max-width:85vw;
      box-shadow:0 8px 30px rgba(0,0,0,0.2);
    `

    let html = ''
    if (opts.title) html += `<div style="padding:20px 24px 8px;font-size:17px;font-weight:600;text-align:center">${opts.title}</div>`
    if (opts.content) html += `<div style="padding:${opts.title ? '8px' : '20px'} 24px;font-size:15px;color:#666;text-align:center;line-height:1.5">${opts.content}</div>`
    if (opts.editable) {
      html += `<div style="padding:8px 24px 20px"><input id="__uni_modal_input" type="text" placeholder="${opts.placeholderText || ''}" style="width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box"></div>`
    }
    html += `<div style="display:flex;border-top:1px solid #eee">`
    if (opts.showCancel !== false) {
      html += `<div id="__uni_modal_cancel" style="flex:1;padding:14px;text-align:center;font-size:16px;color:#999;cursor:pointer">${opts.cancelText || '取消'}</div>`
      if (opts.showCancel !== false) html += `<div style="width:1px;background:#eee"></div>`
    }
    html += `<div id="__uni_modal_confirm" style="flex:1;padding:14px;text-align:center;font-size:16px;color:#409EFF;font-weight:600;cursor:pointer">${opts.confirmText || '确定'}</div>`
    html += `</div>`
    dialog.innerHTML = html

    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    const cleanup = (result: { confirm: boolean; cancel: boolean; content?: string }) => {
      overlay.remove()
      resolve(result)
    }

    const confirmBtn = dialog.querySelector('#__uni_modal_confirm') as HTMLElement
    const cancelBtn = dialog.querySelector('#__uni_modal_cancel') as HTMLElement

    confirmBtn?.addEventListener('click', () => {
      const input = document.getElementById('__uni_modal_input') as HTMLInputElement
      cleanup({ confirm: true, cancel: false, content: input?.value })
    })
    cancelBtn?.addEventListener('click', () => cleanup({ confirm: false, cancel: true }))
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup({ confirm: false, cancel: true })
    })
  })
}

function showActionSheet(opts: { title?: string; itemList: string[] }): Promise<{ tapIndex: number; cancel: boolean }> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed; left:0; top:0; width:100%; height:100%;
      display:flex; align-items:flex-end; justify-content:center;
      background:rgba(0,0,0,0.4); z-index:99997; backdrop-filter:blur(2px);
    `
    const sheet = document.createElement('div')
    sheet.style.cssText = `
      background:#fff; border-radius:14px 14px 0 0; width:100%; max-width:500px;
      overflow:hidden; animation:__uniSheetUp 0.25s ease-out;
    `
    let html = ''
    if (opts.title) html += `<div style="padding:16px;font-size:14px;color:#999;text-align:center;border-bottom:1px solid #eee">${opts.title}</div>`
    opts.itemList.forEach((item, i) => {
      html += `<div data-index="${i}" style="padding:16px;text-align:center;font-size:17px;border-bottom:1px solid #f5f5f5;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">${item}</div>`
    })
    html += `<div style="padding:8px 0;margin-top:6px">`
    html += `<div id="__uni_action_cancel" style="padding:16px;text-align:center;font-size:17px;color:#999;cursor:pointer">取消</div>`
    html += `</div>`
    sheet.innerHTML = html
    overlay.appendChild(sheet)
    document.body.appendChild(overlay)

    const cleanup = (result: { tapIndex: number; cancel: boolean }) => {
      overlay.remove(); resolve(result)
    }
    sheet.querySelectorAll('[data-index]').forEach(el => {
      el.addEventListener('click', () => cleanup({ tapIndex: Number((el as HTMLElement).dataset.index), cancel: false }))
    })
    sheet.querySelector('#__uni_action_cancel')?.addEventListener('click', () => cleanup({ tapIndex: -1, cancel: true }))
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup({ tapIndex: -1, cancel: true }) })
  })
}

// Inject sheet animation
const _sheetStyle = document.createElement('style')
_sheetStyle.textContent = `@keyframes __uniSheetUp { from { transform:translateY(100%) } to { transform:translateY(0) } }`
document.head?.appendChild?.(_sheetStyle)

/* ======================== Navigation ======================== */
function _resolveUrl(url: string): string {
  // uni-app uses absolute paths with .vue extension: /pages/index/index
  // vue-router uses hash paths
  const p = url.split('?')[0]
  return p
}

function navigateTo(opts: { url: string } | string) {
  const url = typeof opts === 'string' ? opts : opts.url
  const [path, queryStr] = url.split('?')
  router.push(queryStr ? { path, query: Object.fromEntries(new URLSearchParams(queryStr)) } : path)
}

function navigateBack(opts?: { delta?: number }) {
  const delta = opts?.delta || 1
  router.go(-delta)
}

function redirectTo(opts: { url: string } | string) {
  const url = typeof opts === 'string' ? opts : opts.url
  const [path, queryStr] = url.split('?')
  router.replace(queryStr ? { path, query: Object.fromEntries(new URLSearchParams(queryStr)) } : path)
}

function reLaunch(opts: { url: string } | string) {
  const url = typeof opts === 'string' ? opts : opts.url
  const [path, queryStr] = url.split('?')
  router.replace(queryStr ? { path, query: Object.fromEntries(new URLSearchParams(queryStr)) } : path)
}

/* ======================== Request ======================== */
function request<T = any>(opts: {
  url: string; method?: string; data?: any; header?: Record<string, string>; dataType?: string
}): Promise<UniApp.RequestSuccessCallbackResult> {
  return new Promise((resolve, reject) => {
    const method = (opts.method || 'GET').toUpperCase()
    const headers: Record<string, string> = { ...opts.header }
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'

    const xhr = new XMLHttpRequest()
    xhr.open(method, opts.url)

    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))

    xhr.onload = () => {
      let data: any = null
      try { data = JSON.parse(xhr.responseText) } catch { data = xhr.responseText }
      resolve({
        data,
        statusCode: xhr.status,
        header: {} as any,
        cookies: [],
        errMsg: 'request:ok',
      } as any)
    }
    xhr.onerror = () => reject(new Error('request:fail'))
    xhr.ontimeout = () => reject(new Error('request:timeout'))

    if (data && method !== 'GET') {
      xhr.send(typeof data === 'string' ? data : JSON.stringify(data))
    } else {
      xhr.send()
    }
  })
}

/* ======================== Upload / Choose File ======================== */
function uploadFile(opts: {
  url: string; filePath: string; name: string; formData?: Record<string, string>; header?: Record<string, string>;
  success?: (res: { data: string; statusCode: number }) => void;
  fail?: (err: any) => void; complete?: (res: any) => void;
}): Promise<{ data: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    if (opts.formData) {
      Object.entries(opts.formData).forEach(([k, v]) => formData.append(k, v))
    }
    // filePath is a blob URL or Data URL from chooseImage
    fetch(opts.filePath)
      .then(r => r.blob())
      .then(blob => {
        formData.append(opts.name, blob, 'file')
        const xhr = new XMLHttpRequest()
        xhr.open('POST', opts.url)
        if (opts.header) {
          Object.entries(opts.header).forEach(([k, v]) => xhr.setRequestHeader(k, v))
        }
        xhr.onload = () => {
          const result = { data: xhr.responseText, statusCode: xhr.status }
          resolve(result)
          opts?.success?.(result)
          opts?.complete?.(result)
        }
        xhr.onerror = () => {
          const err = new Error('upload fail')
          reject(err)
          opts?.fail?.(err)
          opts?.complete?.(err)
        }
        xhr.send(formData)
      })
      .catch((err) => {
        reject(err)
        opts?.fail?.(err)
        opts?.complete?.(err)
      })
  })
}

function chooseImage(opts?: {
  count?: number; sizeType?: string[]; sourceType?: string[];
  success?: (res: { tempFilePaths: string[]; tempFiles: { path: string; size: number }[] }) => void;
  fail?: (err: any) => void; complete?: (res: any) => void;
}): Promise<{
  tempFilePaths: string[]; tempFiles: { path: string; size: number }[]
}> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (opts?.count && opts.count > 1) input.multiple = true
    input.style.display = 'none'

    input.onchange = () => {
      const files = Array.from(input.files || [])
      const tempFiles = files.map(f => ({
        path: URL.createObjectURL(f),
        size: f.size,
      }))
      const result = {
        tempFilePaths: tempFiles.map(f => f.path),
        tempFiles,
      }
      resolve(result)
      opts?.success?.(result)
      opts?.complete?.(result)
    }
    input.onerror = () => {
      const err = new Error('chooseImage:fail')
      reject(err)
      opts?.fail?.(err)
      opts?.complete?.(err)
    }
    document.body.appendChild(input)
    input.click()
    setTimeout(() => input.remove(), 1000)
  })
}

function chooseMessageFile(opts?: {
  count?: number; type?: string;
  success?: (res: { tempFiles: { path: string; name: string; size: number }[] }) => void;
  fail?: (err: any) => void; complete?: (res: any) => void;
}): Promise<{
  tempFiles: { path: string; name: string; size: number }[]
}> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (opts?.count && opts.count > 1) input.multiple = true
    input.style.display = 'none'

    input.onchange = () => {
      const tempFiles = Array.from(input.files || []).map(f => ({
        path: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
      }))
      const result = { tempFiles }
      resolve(result)
      opts?.success?.(result)
      opts?.complete?.(result)
    }
    input.onerror = () => {
      const err = new Error('chooseMessageFile:fail')
      reject(err)
      opts?.fail?.(err)
      opts?.complete?.(err)
    }
    document.body.appendChild(input)
    input.click()
    setTimeout(() => input.remove(), 1000)
  })
}

function setClipboardData(opts: { data: string }): Promise<void> {
  return navigator.clipboard?.writeText(opts.data) || Promise.resolve()
}

/* ======================== Stubs ======================== */
function login(_opts?: any): Promise<{ code: string; errMsg: string }> {
  console.warn('[uni-shim] uni.login is not available in H5 — returning mock code')
  return Promise.resolve({ code: 'mock-code', errMsg: 'login:ok' })
}

function previewImage(opts: { urls: string[]; current?: string; indicator?: string; loop?: boolean }): Promise<void> {
  // Simple lightbox: open first image in new tab
  const url = opts.current || opts.urls[0]
  if (url) window.open(url, '_blank')
  return Promise.resolve()
}

/* ======================== Page Stack (stub) ======================== */
function getCurrentPages(): any[] {
  // Return a minimal stub to avoid errors in useRouteGuard
  return [{ route: router.currentRoute.value?.path || '', $page: { fullPath: router.currentRoute.value?.path || '' } }]
}

/* ======================== Export ======================== */
const uni = {
  // Event Bus
  $on, $off, $emit,
  // Storage
  getStorageSync, setStorageSync, removeStorageSync,
  // System & Device
  getSystemInfoSync, getSystemInfo, getDeviceInfo, requireNativePlugin, createAnimation,
  // Base64
  base64ToArrayBuffer, arrayBufferToBase64,
  // UI
  showToast, showLoading, hideLoading, showModal, showActionSheet,
  // Navigation
  navigateTo, navigateBack, redirectTo, reLaunch,
  // Network
  request, uploadFile,
  // File / Media
  chooseImage, chooseMessageFile, setClipboardData, previewImage,
  // Auth
  login,
  // Pages
  getCurrentPages,
  // Additional
  getLocation(_opts?: any) { return Promise.reject(new Error('[uni-shim] getLocation not available')) },
} as any

// Global registration
if (typeof window !== 'undefined') {
  ;(window as any).uni = uni
}

export default uni
