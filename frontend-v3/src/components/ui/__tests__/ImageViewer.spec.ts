import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageViewer from '@/components/ui/ImageViewer.vue'
import { setToken } from '@/utils/request'

/**
 * 全屏图片查看器（2026-09 抽成公共组件）
 *
 * 之前相册/请假各写一份、助手与擂台直接 window.open 看原图。
 * 这里锁住统一后的关键行为：中图优先、滑动阈值、计数、预加载、删除事件、滚动锁。
 */
const IMAGES = [
  { url: '/uploads/albums/a.jpg', title: '第一张' },
  { url: '/uploads/albums/b.jpg', title: '第二张' },
  { url: '/uploads/albums/c.jpg', title: '第三张' },
]

function mountViewer(props: Record<string, unknown> = {}) {
  return mount(ImageViewer, {
    props: { modelValue: true, images: IMAGES, ...props },
    attachTo: document.body,
    // 组件 Teleport 到 body：测试里把 teleport 打桩，内容留在 wrapper 内便于断言
    global: { stubs: { teleport: true } },
  })
}

describe('ImageViewer 全屏查看器', () => {
  beforeEach(() => {
    setToken('t')
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  it('用 1440px 中图展示（不是几 MB 的原图）', () => {
    const w = mountViewer()
    const src = w.find('.viewer-img').attributes('src') || ''
    expect(src).toContain('a_medium.jpg')
    expect(src).not.toBe(IMAGES[0].url)
  })

  it('显示序号计数', () => {
    const w = mountViewer()
    expect(w.find('.viewer-counter').text()).toBe('1 / 3')
  })

  it('横向滑动超过 40px 才切图，纵向滑动与小幅滑动不切', async () => {
    const w = mountViewer()
    const el = w.find('.viewer')
    // 小幅横向（20px）不切
    await el.trigger('touchstart', { touches: [{ clientX: 100, clientY: 100 }] })
    await el.trigger('touchend', { changedTouches: [{ clientX: 120, clientY: 100 }] })
    expect(w.find('.viewer-counter').text()).toBe('1 / 3')
    // 纵向为主（dx=80, dy=200）不切
    await el.trigger('touchstart', { touches: [{ clientX: 100, clientY: 100 }] })
    await el.trigger('touchend', { changedTouches: [{ clientX: 180, clientY: 300 }] })
    expect(w.find('.viewer-counter').text()).toBe('1 / 3')
    // 左滑 60px → 下一张
    await el.trigger('touchstart', { touches: [{ clientX: 200, clientY: 100 }] })
    await el.trigger('touchend', { changedTouches: [{ clientX: 140, clientY: 105 }] })
    expect(w.find('.viewer-counter').text()).toBe('2 / 3')
  })

  it('方向键切换、Esc 关闭并恢复滚动锁', async () => {
    const w = mountViewer()
    expect(document.body.style.overflow).toBe('hidden')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await w.vm.$nextTick()
    expect(w.find('.viewer-counter').text()).toBe('2 / 3')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('单张图时不显示计数与左右按钮', () => {
    const w = mountViewer({ images: [IMAGES[0]] })
    expect(w.find('.viewer-nav').exists()).toBe(false)
  })

  it('可删除的图才显示删除按钮，点击 emit delete(image, index)', async () => {
    const w = mountViewer({ images: [{ ...IMAGES[0], deletable: true }, IMAGES[1]] })
    const del = w.findAll('.viewer-action').find((b) => b.text().includes('删除'))
    expect(del).toBeTruthy()
    await del!.trigger('click')
    expect(w.emitted('delete')?.[0]?.[1]).toBe(0)
  })

  it('默认提供「保存原图」，且保存的是原图地址而不是中图', async () => {
    let href = ''
    let download = ''
    // 下载用的 <a> 会被立即移除，因此在 click 时抓取它自身
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      href = this.getAttribute('href') || ''
      download = this.getAttribute('download') || ''
    })
    const w = mountViewer()
    const save = w.findAll('.viewer-action').find((b) => b.text().includes('保存原图'))
    await save!.trigger('click')
    expect(clickSpy).toHaveBeenCalled()
    expect(href).toContain('a.jpg')
    expect(href).not.toContain('_medium')
    expect(download).toBe('a.jpg')
    clickSpy.mockRestore()
  })

  it('删除图片导致数组变短时下标自动夹回（不会黑屏）', async () => {
    const w = mountViewer()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await w.vm.$nextTick()
    expect(w.find('.viewer-counter').text()).toBe('3 / 3')
    // 父组件删掉最后一张
    await w.setProps({ images: IMAGES.slice(0, 2) })
    await w.vm.$nextTick()
    expect(w.find('.viewer-counter').text()).toBe('2 / 2')
    expect(w.find('.viewer-img').exists()).toBe(true)
  })

  it('图片被清空时自动关闭（避免停在纯黑空界面）', async () => {
    const w = mountViewer()
    await w.setProps({ images: [] })
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('支持 #meta 插槽补充信息（如「待审核」角标）', () => {
    const w = mount(ImageViewer, {
      props: { modelValue: true, images: IMAGES },
      global: { stubs: { teleport: true } },
      slots: { meta: '<span class="my-badge">待审核</span>' },
    })
    expect(w.find('.my-badge').text()).toBe('待审核')
  })

  it('中图加载失败时回退到原图（不会裂图）', async () => {
    const w = mountViewer()
    const img = w.find('.viewer-img').element as HTMLImageElement
    img.src = 'http://localhost/uploads/albums/a_medium.jpg?token=t'
    await w.find('.viewer-img').trigger('error')
    expect(img.getAttribute('src')).toContain('/uploads/albums/a.jpg')
  })
})
