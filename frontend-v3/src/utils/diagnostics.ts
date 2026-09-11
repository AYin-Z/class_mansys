/**
 * 前端诊断上报（2026-09 手机端白屏排查）
 *
 * 场景：用户手机上「底部导航能看见、内容区一片白」，而桌面正常。
 * 这类问题只发生在用户设备上，服务端日志只能看到请求成功，
 * 拿不到任何现场信息。这里用 sendBeacon 把关键错误上报到
 * 后端 /api/client-log（免鉴权、限流、截断），落到 logs/client-errors.log。
 *
 * 上报内容刻意保持最小：类型、构建号、消息、堆栈前若干行、UA、视口。
 * 不包含任何业务数据与用户输入。
 */

const BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'unknown'

export type ClientLogKind =
  | 'boot-ok' | 'error' | 'unhandledrejection' | 'route-error' | 'vue-error' | 'timeout'
  /** 路由已切换但内容区是空的：把现场快照一并上报（2026-09-11 手机端"内容全白"排查用） */
  | 'empty-content'
  /** 内容正常时的抽样（只上报一次，用于确认设备链路） */
  | 'content-ok'

interface ClientLogPayload {
  kind: ClientLogKind
  build?: string
  url?: string
  message?: string
  stack?: string
  viewport?: string
  /** 现场快照（只有 empty-content / content-ok 会带） */
  snapshot?: Record<string, unknown>
}

const CLIP = 600

function clip(v: unknown): string {
  const s = typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)
  return s.length > CLIP ? s.slice(0, CLIP) : s
}

export function reportClient(payload: ClientLogPayload): void {
  try {
    const body = JSON.stringify({
      kind: payload.kind,
      build: payload.build || BUILD_ID,
      url: payload.url || (typeof location !== 'undefined' ? location.href : ''),
      message: clip(payload.message),
      stack: clip(payload.stack),
      viewport: payload.viewport || (typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : ''),
      snapshot: payload.snapshot,
    })
    // sendBeacon 不阻塞、页面崩溃/卸载时也能发出；不支持时退回 fetch(keepalive)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/client-log', blob)) return
    }
    void fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* 上报失败不影响业务 */ })
  } catch {
    /* 上报本身绝不能抛错 */
  }
}

/**
 * 采集"内容区到底渲染成什么样"的现场快照
 *
 * 手机端出现过：TabBar 正常、无任何 JS 报错、但内容区一片白。
 * 这类问题必须看设备现场的样式与 DOM 结构，因此把关键计算值一起上报。
 */
export function collectSnapshot(routePath: string): Record<string, unknown> {
  try {
    const content = document.querySelector('.app-content') as HTMLElement | null
    const pageRoot = content?.firstElementChild as HTMLElement | null
    const cs = pageRoot ? getComputedStyle(pageRoot) : null
    const rootCs = getComputedStyle(document.documentElement)
    const rect = pageRoot?.getBoundingClientRect()
    return {
      route: routePath,
      hash: location.hash,
      contentTextLen: (content?.innerText || '').trim().length,
      contentTextHead: (content?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
      contentChildCount: content?.children.length ?? -1,
      pageRootClass: pageRoot ? String(pageRoot.className) : null,
      pageRootRect: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.top)}` : null,
      pageRootDisplay: cs?.display || null,
      pageRootVisibility: cs?.visibility || null,
      pageRootOpacity: cs?.opacity || null,
      pageRootColor: cs?.color || null,
      pageRootBg: cs?.backgroundColor || null,
      pageRootOverflow: cs?.overflow || null,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      theme: document.documentElement.getAttribute('data-theme'),
      prefersDark: typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)').matches : null,
      varBg: rootCs.getPropertyValue('--color-bg').trim(),
      varText: rootCs.getPropertyValue('--color-text').trim(),
      varTabbarH: rootCs.getPropertyValue('--tabbar-h').trim(),
      styleSheets: document.styleSheets.length,
      tabbar: !!document.querySelector('.tab-bar'),
      scrollY: Math.round(window.scrollY),
      docHeight: document.documentElement.scrollHeight,
    }
  } catch (e) {
    return { snapshotError: String((e as Error)?.message || e) }
  }
}

/** 应用挂载成功：让 index.html 的兜底面板撤掉，同时留一条"这台设备正常启动"的记录 */
export function reportBootOk(): void {
  reportClient({ kind: 'boot-ok' })
  try {
    const w = window as unknown as { __APP_BOOT_OK__?: () => void }
    w.__APP_BOOT_OK__?.()
  } catch { /* ignore */ }
}
