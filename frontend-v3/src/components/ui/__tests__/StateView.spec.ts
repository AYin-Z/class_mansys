import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StateView from '@/components/ui/StateView.vue'

/**
 * 三态容器是 B2 的地基：全站列表页都靠它区分
 * 「加载中 / 失败可重试 / 真的没有数据」。审计的 P0 就是 30 处 catch(_){}
 * 把失败渲染成「暂无数据」，这里锁住行为避免回归。
 */
describe('StateView 三态容器', () => {
  it('loading 时显示骨架屏，不显示内容', () => {
    const w = mount(StateView, { props: { loading: true }, slots: { default: '<div class="content">真实数据</div>' } })
    expect(w.find('.skeleton').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
  })

  it('error 时显示「加载失败」与重试按钮，点击 emit retry', async () => {
    const w = mount(StateView, { props: { error: new Error('boom') } })
    expect(w.text()).toContain('加载失败')
    expect(w.find('.retry-btn').exists()).toBe(true)
    await w.find('.retry-btn').trigger('click')
    expect(w.emitted('retry')).toBeTruthy()
  })

  it('网络类错误会翻译成用户看得懂的中文文案', () => {
    const err = Object.assign(new Error('Failed to fetch'), { name: 'TypeError', status: 0 })
    const w = mount(StateView, { props: { error: err } })
    expect(w.text()).toContain('网络连接失败')
  })

  it('超时错误给出可操作提示', () => {
    const err = Object.assign(new Error('timeout'), { code: 'TIMEOUT' })
    const w = mount(StateView, { props: { error: err } })
    expect(w.text()).toContain('请求超时')
  })

  it('empty 时渲染空态标题与 CTA，点击 CTA emit empty-action', async () => {
    const w = mount(StateView, {
      props: { empty: true, emptyTitle: '还没有请假记录', emptyActionText: '发起请假' },
    })
    expect(w.text()).toContain('还没有请假记录')
    const btn = w.find('.empty-action')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('empty-action')).toBeTruthy()
  })

  it('筛选无结果用 filtered 空态（文案/图标与真空态不同）', () => {
    const w = mount(StateView, {
      props: { empty: true, emptyVariant: 'filtered', emptyTitle: '当前筛选条件下没有记录' },
    })
    expect(w.find('.empty-filtered').exists()).toBe(true)
    expect(w.text()).toContain('当前筛选条件下没有记录')
  })

  it('正常态渲染插槽内容', () => {
    const w = mount(StateView, { slots: { default: '<div class="content">列表</div>' } })
    expect(w.find('.content').exists()).toBe(true)
    expect(w.find('.skeleton').exists()).toBe(false)
  })
})
