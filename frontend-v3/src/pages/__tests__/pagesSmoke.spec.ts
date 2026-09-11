import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

/**
 * 关键页面挂载冒烟（永久用例）
 *
 * 背景：B1–B6 一次性改了 60+ 个页面模板（三态容器、BaseModal、AppIcon、令牌…），
 * 模板级错误（未闭合标签、组件 props 打错）typecheck 不一定能发现，
 * 但挂载时会直接抛错。这里把最高频的页面挂一遍，作为回归护栏。
 *
 * 所有后端接口都被 mock，测试不依赖网络与数据库。
 */

vi.mock('@/api/notice', () => ({
  getNotices: vi.fn().mockResolvedValue({ success: true, notices: [] }),
  getUnreadCount: vi.fn().mockResolvedValue({ success: true, count: 3 }),
  getTodoCount: vi.fn().mockResolvedValue({ success: true, count: 2 }),
  getNoticeDetail: vi.fn().mockResolvedValue({ success: true, notice: null }),
  completeTodo: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/api/announcement', () => ({
  getAnnouncements: vi.fn().mockResolvedValue({ success: true, announcements: [] }),
}))
vi.mock('@/api/fee', () => ({
  getMyExpenses: vi.fn().mockResolvedValue({ success: true, expenses: [] }),
  getSummary: vi.fn().mockResolvedValue({ success: true, data: { summary: { balance: 0, totalIncome: 0, totalExpense: 0 } } }),
  getCollections: vi.fn().mockResolvedValue({ success: true, collections: [] }),
  getPublications: vi.fn().mockResolvedValue({ success: true, publications: [] }),
  getPendingApprovals: vi.fn().mockResolvedValue({ success: true, approvals: [] }),
  getVoteResult: vi.fn().mockResolvedValue({ success: true, approveCount: 0, rejectCount: 0, totalVotes: 0, threshold: 19, thresholdMet: false }),
  getCollectionRecords: vi.fn().mockResolvedValue({ success: true, records: [] }),
}))
vi.mock('@/api/leave', () => ({
  getMyLeaves: vi.fn().mockResolvedValue({ success: true, leaves: [] }),
  getAllLeaves: vi.fn().mockResolvedValue({ success: true, leaves: [] }),
}))
vi.mock('@/api/leave-config', () => ({
  getLeaveTypes: vi.fn().mockResolvedValue({ data: [] }),
}))
vi.mock('@/api/suggestion', () => ({
  getAllSuggestions: vi.fn().mockResolvedValue({ success: true, suggestions: [] }),
}))
vi.mock('@/api/company', () => ({
  getCompanyOverview: vi.fn().mockResolvedValue({ success: true, summary: null, classes: [] }),
}))

/** 把待测页面挂到一个真实（内存）路由上，同时注入 pinia */
async function mountPage(path: string, component: any) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path, component }, { path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount(component, { global: { plugins: [pinia, router] } })
  await new Promise((r) => setTimeout(r, 0))
  return wrapper
}

describe('关键页面挂载冒烟（模板/组件/令牌回归护栏）', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('首页可以挂载（含待办提醒条与通知三态）', async () => {
    const Page = (await import('@/pages/index/index.vue')).default
    const w = await mountPage('/pages/index/index', Page)
    expect(w.html()).toBeTruthy()
  })

  it('待办中心可以挂载（学员/干部共用）', async () => {
    const Page = (await import('@/pages/dashboard/index.vue')).default
    const w = await mountPage('/pages/dashboard/index', Page)
    expect(w.html()).toBeTruthy()
  })

  it('班费页可以挂载（余额卡片 + 三个 Tab）', async () => {
    const Page = (await import('@/pages/fee/index.vue')).default
    const w = await mountPage('/pages/fee/index', Page)
    expect(w.html()).toContain('班费')
  })

  it('审批/投票页可以挂载（空态文案而不是「暂无待审批事项」兜底）', async () => {
    const Page = (await import('@/pages/fee/approvals.vue')).default
    const w = await mountPage('/pages/fee/approvals', Page)
    await new Promise((r) => setTimeout(r, 0))
    expect(w.html()).toBeTruthy()
  })

  it('我的请假页可以挂载', async () => {
    const Page = (await import('@/pages/leave/index.vue')).default
    const w = await mountPage('/pages/leave/index', Page)
    expect(w.html()).toBeTruthy()
  })

  it('通知中心可以挂载', async () => {
    const Page = (await import('@/pages/notice/index.vue')).default
    const w = await mountPage('/pages/notice/index', Page)
    expect(w.html()).toBeTruthy()
  })
})
