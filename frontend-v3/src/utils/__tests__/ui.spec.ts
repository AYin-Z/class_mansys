import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { showToast, showConfirm, clearToasts } from '@/utils/ui'

describe('反馈层 ui.ts（Toast / Confirm）', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearToasts()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('Toast 使用 px 单位（历史上用 rpx，浏览器会直接丢弃导致无内边距无圆角）', () => {
    showToast('提交成功', 'success')
    const el = document.querySelector('#__toast_root__ > div') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.style.padding).toBe('10px 16px')
    expect(el.style.borderRadius).toBe('var(--radius-md, 10px)')
    expect(el.style.fontSize).toBe('14px')
    expect(el.textContent).toContain('提交成功')
  })

  it('同一条文案在去重窗口内只弹一次（并发请求同时失败不刷屏）', () => {
    showToast('网络连接失败，请检查网络后重试', 'error')
    showToast('网络连接失败，请检查网络后重试', 'error')
    showToast('网络连接失败，请检查网络后重试', 'error')
    expect(document.querySelectorAll('#__toast_root__ > div').length).toBe(1)
  })

  it('不同文案会叠加而不是互相覆盖（页面兜底文案不再盖掉后端具体原因）', () => {
    showToast('该时段已有请假', 'error')
    showToast('提交失败，请稍后重试', 'error')
    const texts = Array.from(document.querySelectorAll('#__toast_root__ > div')).map((n) => n.textContent)
    expect(texts.join('|')).toContain('该时段已有请假')
    expect(texts.join('|')).toContain('提交失败，请稍后重试')
  })

  it('Toast 到时间会自行消失', () => {
    showToast('已保存')
    expect(document.querySelectorAll('#__toast_root__ > div').length).toBe(1)
    vi.advanceTimersByTime(3000)
    expect(document.querySelectorAll('#__toast_root__ > div').length).toBe(0)
  })

  it('Confirm 渲染标题、内容与后果提示，点确认返回 true', async () => {
    const p = showConfirm('删除通知', '《关于晚点名时间调整》', {
      danger: true,
      confirmText: '删除',
      hint: '删除后不可恢复',
    })
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('删除通知')
    expect(dialog.textContent).toContain('关于晚点名时间调整')
    expect(dialog.textContent).toContain('删除后不可恢复')
    const buttons = Array.from(dialog.querySelectorAll('button'))
    const okBtn = buttons.find((b) => b.textContent === '删除') as HTMLButtonElement
    expect(okBtn).toBeTruthy()
    okBtn.click()
    await expect(p).resolves.toBe(true)
  })

  it('Confirm 点遮罩等同于取消（此前点遮罩无反应会卡住）', async () => {
    const p = showConfirm('销假', '确认销假？')
    const mask = document.querySelector('[role="dialog"]') as HTMLElement
    mask.click()
    await expect(p).resolves.toBe(false)
  })
})
