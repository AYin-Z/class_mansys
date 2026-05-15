import { showToast, showConfirm } from '@/utils/ui'
/**
 * 轻量级 Toast 提示 — 替换 uni.showToast
 */
const TOAST_DURATION = 2000

let _toastTimer: ReturnType<typeof setTimeout> | null = null

function removeToast() {
  const el = document.getElementById('__toast__')
  if (el) el.remove()
}

export function showToast(title: string, icon: 'success' | 'error' | 'none' = 'none') {
  removeToast()
  if (_toastTimer) clearTimeout(_toastTimer)

  const toast = document.createElement('div')
  toast.id = '__toast__'
  toast.textContent = title
  Object.assign(toast.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(0,0,0,0.78)',
    color: '#fff',
    padding: '20rpx 40rpx',
    borderRadius: '12rpx',
    fontSize: '28rpx',
    zIndex: '99999',
    maxWidth: '80%',
    textAlign: 'center',
    pointerEvents: 'none',
  })
  document.body.appendChild(toast)

  _toastTimer = setTimeout(removeToast, TOAST_DURATION)
}

/**
 * 轻量级确认弹窗 — 替换 uni.showModal
 */
export function showConfirm(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    const mask = document.createElement('div')
    mask.id = '__confirm__'
    Object.assign(mask.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '99999',
    })

    const box = document.createElement('div')
    Object.assign(box.style, {
      background: '#fff',
      borderRadius: '24rpx',
      padding: '40rpx',
      maxWidth: '600rpx',
      width: '85%',
      textAlign: 'center',
    })

    if (title) {
      const titleEl = document.createElement('div')
      titleEl.textContent = title
      Object.assign(titleEl.style, {
        fontSize: '32rpx',
        fontWeight: '700',
        marginBottom: '16rpx',
      })
      box.appendChild(titleEl)
    }

    if (content) {
      const contentEl = document.createElement('div')
      contentEl.textContent = content
      Object.assign(contentEl.style, {
        fontSize: '28rpx',
        color: '#666',
        marginBottom: '32rpx',
      })
      box.appendChild(contentEl)
    }

    const btnRow = document.createElement('div')
    Object.assign(btnRow.style, {
      display: 'flex',
      gap: '20rpx',
    })

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    Object.assign(cancelBtn.style, {
      flex: '1',
      padding: '20rpx',
      borderRadius: '12rpx',
      border: 'none',
      background: '#f0f0f0',
      fontSize: '28rpx',
      cursor: 'pointer',
    })
    cancelBtn.onclick = () => { mask.remove(); resolve(false) }

    const okBtn = document.createElement('button')
    okBtn.textContent = '确定'
    Object.assign(okBtn.style, {
      flex: '1',
      padding: '20rpx',
      borderRadius: '12rpx',
      border: 'none',
      background: '#1a73e8',
      color: '#fff',
      fontSize: '28rpx',
      cursor: 'pointer',
    })
    okBtn.onclick = () => { mask.remove(); resolve(true) }

    btnRow.appendChild(cancelBtn)
    btnRow.appendChild(okBtn)
    box.appendChild(btnRow)
    mask.appendChild(box)
    document.body.appendChild(mask)
  })
}
