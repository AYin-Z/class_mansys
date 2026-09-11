/**
 * 轻量级反馈层：Toast / Confirm / ActionSheet
 *
 * 2026-09 修复（P0）：
 *  1. 全文件此前使用小程序单位 rpx，浏览器 CSSOM 会直接丢弃非法值 ——
 *     所有提示实际都是"无内边距、无圆角、字号失效"的黑块。现统一 px + 设计令牌。
 *  2. Toast 此前是"新的替换旧的"（removeToast 再新建），
 *     于是页面 catch 里的一句「操作失败」会把 request 层刚弹出的
 *     「该时段已有请假」覆盖掉，用户永远看不到可自行修正的原因。
 *     现改为：同文案窗口内去重、不同文案排队叠放、最多同时 3 条。
 *  3. Confirm 之前没有危险态、没有按钮文案自定义、点击遮罩不关闭、没有 ESC。
 */

const TOAST_DURATION = 2200
const TOAST_MAX_VISIBLE = 3
const TOAST_DEDUP_WINDOW = 800

export type ToastIcon = 'success' | 'error' | 'none'

interface ToastRecord {
  el: HTMLElement
  timer: ReturnType<typeof setTimeout>
}

const _toasts: ToastRecord[] = []
const _recent: { text: string; at: number }[] = []

function toastRoot(): HTMLElement {
  let root = document.getElementById('__toast_root__')
  if (!root) {
    root = document.createElement('div')
    root.id = '__toast_root__'
    Object.assign(root.style, {
      position: 'fixed',
      left: '50%',
      bottom: 'calc(var(--tabbar-h, 56px) + 24px)',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column-reverse',
      alignItems: 'center',
      gap: '8px',
      zIndex: 'var(--z-toast, 99999)',
      pointerEvents: 'none',
      maxWidth: '86vw',
    })
    document.body.appendChild(root)
  }
  return root
}

function dropToast(record: ToastRecord) {
  const idx = _toasts.indexOf(record)
  if (idx > -1) _toasts.splice(idx, 1)
  clearTimeout(record.timer)
  record.el.style.opacity = '0'
  setTimeout(() => record.el.remove(), 150)
}

function removeToastById(id: string) {
  const record = _toasts.find((t) => t.el.dataset.id === id)
  if (record) dropToast(record)
}

const ICONS: Record<ToastIcon, string> = { success: '✓', error: '!', none: '' }

/**
 * 轻量级 Toast
 * @param title 文案（支持换行，会自动换行显示）
 * @param icon  语义图标：success / error / none
 */
export function showToast(title: string, icon: ToastIcon = 'none') {
  const text = String(title ?? '').trim()
  if (!text) return

  // 去重：同一条文案在窗口期内重复出现（例如并发请求同时失败）只保留一条
  const now = Date.now()
  const dup = _recent.find((r) => r.text === text)
  if (dup && now - dup.at < TOAST_DEDUP_WINDOW) {
    dup.at = now
    return
  }
  _recent.push({ text, at: now })
  if (_recent.length > 20) _recent.shift()

  const root = toastRoot()
  if (_toasts.length >= TOAST_MAX_VISIBLE) dropToast(_toasts[0])

  const el = document.createElement('div')
  const id = `t${now}${Math.random().toString(36).slice(2, 6)}`
  el.dataset.id = id
  el.setAttribute('role', 'status')

  const glyph = ICONS[icon] || ''
  if (glyph) {
    const iconEl = document.createElement('span')
    iconEl.textContent = glyph
    Object.assign(iconEl.style, {
      flex: '0 0 auto',
      width: '18px',
      height: '18px',
      lineHeight: '18px',
      textAlign: 'center',
      borderRadius: '50%',
      fontSize: '12px',
      fontWeight: '700',
      color: '#fff',
      background: icon === 'error' ? 'var(--color-error, #ef4444)' : 'var(--color-success, #10b981)',
    })
    el.appendChild(iconEl)
  }

  const textEl = document.createElement('span')
  textEl.textContent = text
  Object.assign(textEl.style, { flex: '1 1 auto', whiteSpace: 'pre-line', wordBreak: 'break-word' })
  el.appendChild(textEl)

  Object.assign(el.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    maxWidth: '100%',
    padding: '10px 16px',
    background: 'rgba(17, 24, 39, 0.88)',
    color: '#fff',
    borderRadius: 'var(--radius-md, 10px)',
    fontSize: '14px',
    lineHeight: '1.45',
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
    textAlign: 'left',
    opacity: '0',
    transform: 'translateY(6px)',
    transition: 'opacity .18s ease-out, transform .18s ease-out',
  })
  root.appendChild(el)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })

  const record: ToastRecord = { el, timer: setTimeout(() => removeToastById(id), TOAST_DURATION) }
  _toasts.push(record)
}

export interface ConfirmOptions {
  /** 确认按钮文案，默认「确定」 */
  confirmText?: string
  /** 取消按钮文案，默认「取消」 */
  cancelText?: string
  /** 危险操作（删除/驳回/销假）：确认按钮用红色 */
  danger?: boolean
  /** 补充说明：后果提示，如「删除后不可恢复」 */
  hint?: string
}

/**
 * 轻量级确认弹窗
 *
 * 用法约定（B1 起）：破坏性操作必须写清**对象 + 动作 + 后果**，例如
 *   showConfirm('删除通知', '《关于晚点名时间调整》', { danger: true, hint: '删除后学员端立即不可见，且无法恢复' })
 */
export function showConfirm(title: string, content: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const { confirmText = '确定', cancelText = '取消', danger = false, hint = '' } = options

    const mask = document.createElement('div')
    mask.id = '__confirm__'
    mask.setAttribute('role', 'dialog')
    mask.setAttribute('aria-modal', 'true')
    Object.assign(mask.style, {
      position: 'fixed',
      inset: '0',
      background: 'var(--color-overlay, rgba(0,0,0,0.45))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      zIndex: 'var(--z-modal, 100)',
    })

    const box = document.createElement('div')
    Object.assign(box.style, {
      background: 'var(--color-surface, #fff)',
      color: 'var(--color-text, #1f2937)',
      borderRadius: 'var(--radius-lg, 14px)',
      padding: '20px',
      width: '100%',
      maxWidth: '320px',
      textAlign: 'left',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    })

    if (title) {
      const titleEl = document.createElement('div')
      titleEl.textContent = title
      Object.assign(titleEl.style, { fontSize: '16px', fontWeight: '600', marginBottom: '8px' })
      box.appendChild(titleEl)
    }

    if (content) {
      const contentEl = document.createElement('div')
      contentEl.textContent = content
      Object.assign(contentEl.style, {
        fontSize: '14px',
        color: 'var(--color-text-2, #4b5563)',
        lineHeight: '1.55',
        whiteSpace: 'pre-line',
        wordBreak: 'break-word',
      })
      box.appendChild(contentEl)
    }

    if (hint) {
      const hintEl = document.createElement('div')
      hintEl.textContent = hint
      Object.assign(hintEl.style, {
        marginTop: '8px',
        fontSize: '12px',
        lineHeight: '1.5',
        color: danger ? 'var(--color-error, #ef4444)' : 'var(--color-text-3, #6b7280)',
      })
      box.appendChild(hintEl)
    }

    const btnRow = document.createElement('div')
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', marginTop: '18px' })

    const makeBtn = (label: string, primary: boolean) => {
      const btn = document.createElement('button')
      btn.textContent = label
      Object.assign(btn.style, {
        flex: '1',
        minHeight: '44px',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md, 10px)',
        border: primary ? 'none' : '1px solid var(--color-border, #e5e7eb)',
        background: primary
          ? danger
            ? 'var(--color-error, #ef4444)'
            : 'var(--color-accent, #1d6fe0)'
          : 'var(--color-surface-2, #f9fafb)',
        color: primary ? '#fff' : 'var(--color-text-2, #4b5563)',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
      })
      return btn
    }

    let done = false
    const close = (value: boolean) => {
      if (done) return
      done = true
      document.removeEventListener('keydown', onKey)
      mask.remove()
      resolve(value)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }

    const cancelBtn = makeBtn(cancelText, false)
    cancelBtn.onclick = () => close(false)
    const okBtn = makeBtn(confirmText, true)
    okBtn.onclick = () => close(true)

    // 点击遮罩 = 取消（此前必须点按钮，误触遮罩会卡住）
    mask.onclick = (e) => {
      if (e.target === mask) close(false)
    }
    document.addEventListener('keydown', onKey)

    btnRow.appendChild(cancelBtn)
    btnRow.appendChild(okBtn)
    box.appendChild(btnRow)
    mask.appendChild(box)
    document.body.appendChild(mask)
    okBtn.focus()
  })
}

/** 关闭所有 Toast（页面切换时调用，避免残留） */
export function clearToasts() {
  [..._toasts].forEach(dropToast)
}
