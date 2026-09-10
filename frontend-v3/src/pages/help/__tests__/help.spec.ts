import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const profileRef = { value: { role: 0 } as { role: number } | null }
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    get profile() { return profileRef.value },
  }),
}))

import HelpPage from '@/pages/help/index.vue'
import { MANUAL_SECTIONS } from '@/data/manual'

beforeEach(() => {
  push.mockReset()
  profileRef.value = { role: 0 }
})

function titles(wrapper: ReturnType<typeof mount>): string {
  return wrapper.findAll('.toc-label').map((n) => n.text()).join('|')
}

describe('用户手册页', () => {
  it('学员只看到 all 章节，看不到干部/管理员章节', () => {
    const w = mount(HelpPage)
    const t = titles(w)
    expect(t).toContain('快速上手')
    expect(t).toContain('请假与销假')
    expect(t).not.toContain('中队视角')
    expect(t).not.toContain('管理员运维速查')
  })

  it('干部能看到中队视角，但仍看不到管理员运维章节', () => {
    profileRef.value = { role: 1 }
    const w = mount(HelpPage)
    const t = titles(w)
    expect(t).toContain('中队视角')
    expect(t).not.toContain('管理员运维速查')
  })

  it('超管能看到全部章节', () => {
    profileRef.value = { role: 8 }
    const w = mount(HelpPage)
    expect(w.findAll('.toc-item')).toHaveLength(MANUAL_SECTIONS.length)
  })

  it('搜索命中并自动展开，无结果给出提示', async () => {
    const w = mount(HelpPage)
    const input = w.find('input.search')
    await input.setValue('MCP')
    const cards = w.findAll('.card')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((c) => c.text().includes('MCP') || c.find('.card-body').exists())).toBe(true)
    expect(w.find('.card-body').exists()).toBe(true)

    await input.setValue('不存在的关键词xyz')
    expect(w.find('.empty').exists()).toBe(true)
  })

  it('点击卡片标题可展开/收起', async () => {
    const w = mount(HelpPage)
    const head = w.find('.card-head')
    expect(w.find('.card-body').exists()).toBe(false)
    await head.trigger('click')
    expect(w.find('.card-body').exists()).toBe(true)
    await head.trigger('click')
    expect(w.find('.card-body').exists()).toBe(false)
  })

  it('手册包含 MCP 部署与微信绑定说明（用户明确要求的内容）', () => {
    const all = JSON.stringify(MANUAL_SECTIONS)
    expect(all).toContain('/api/mcp')
    expect(all).toContain('cm_你的令牌')
    expect(all).toContain('/绑定')
    expect(all).toContain('连接自检')
    expect(all).toContain('migrate.js up')
  })
})
