import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import TabBar from '@/components/ui/TabBar.vue'
import { TABS } from '@/router/tabs'
import { useUserStore } from '@/stores/user'

/**
 * TabBar 点击 → 路由 的端到端回归（2026-09-11 事故护栏）
 *
 * 事故：tab 路径写成 `/pages/index`，真实路由是 `/pages/index/index`。
 * 点 tab 后匹配不到组件 → 内容区空白、TabBar 正常、无任何报错。
 * 之前只按完整 URL 访问页面，所以本地永远复现不出来——这个用例专门锁住"点击"这条路径。
 *
 * 这里用真实 router：点击每个 tab 后断言 currentRoute 就是该 tab 的路径，
 * 且该路径能 resolve 到组件（而不是落到兜底路由）。
 */
vi.mock('@/api/notice', () => ({
  getUnreadCount: vi.fn().mockResolvedValue({ success: true, count: 0 }),
  getTodoCount: vi.fn().mockResolvedValue({ success: true, count: 0 }),
}))

function makeRouter() {
  const Stub = { template: '<div class="page-stub" />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: TABS[0].path },
      ...TABS.map((t) => ({ path: t.path, name: t.key, component: Stub })),
      { path: '/:pathMatch(.*)*', name: 'not-found', redirect: TABS[0].path },
    ],
  })
}

describe('TabBar 点击导航（防止 tab 路径写错导致内容空白）', () => {
  let router: ReturnType<typeof makeRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    // 用超管身份：能看到全部 5 个 tab（普通学员看不到「中队/待办」是设计如此）
    const userStore = useUserStore()
    userStore.setProfile({ id: 1, name: '测试超管', role: 8 })
    router = makeRouter()
    router.push(TABS[0].path)
    await router.isReady()
  })

  it('点击每个 tab 都会导航到该 tab 的真实路径，且能匹配到页面组件', async () => {
    const wrapper = mount(TabBar, { global: { plugins: [router] } })
    const items = wrapper.findAll('.tab-item')
    expect(items.length).toBe(TABS.length)

    for (let i = 0; i < TABS.length; i++) {
      await items[i].trigger('click')
      // router.replace 是异步的：等微任务队列清空后再断言
      await flushPromises()
      await router.isReady()
      const current = router.currentRoute.value
      expect(current.path, `点击「${TABS[i].label}」后路径不对`).toBe(TABS[i].path)
      expect(current.matched.length, `点击「${TABS[i].label}」后没有匹配到页面组件（会渲染空白）`).toBeGreaterThan(0)
      expect(current.name, `点击「${TABS[i].label}」落到了兜底路由`).not.toBe('not-found')
    }
  })

  it('每个 tab 都有可点击区域与无障碍标签（移动端可达性）', async () => {
    const wrapper = mount(TabBar, { global: { plugins: [router] } })
    for (const item of wrapper.findAll('.tab-item')) {
      expect(item.attributes('aria-label')).toBeTruthy()
      expect(item.attributes('role')).toBe('tab')
    }
  })
})
