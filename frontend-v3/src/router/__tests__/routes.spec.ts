import { describe, it, expect } from 'vitest'
import router from '@/router'
import { TABS } from '@/router/tabs'

/**
 * 路由与导航一致性回归（2026-09-11 事故护栏）
 *
 * 事故经过：重写 TabBar 时把 tab 路径写成 `/pages/index`，
 * 而路由注册的是 `/pages/index/index`。点击 tab → 匹配不到路由 →
 * 内容区空白、TabBar 还在、**控制台没有任何报错**，靠设备端排查了很久。
 *
 * 这个用例把「导航目标必须能 resolve 到组件」钉死在测试里：
 * 以后任何路径写错，跑 `npm test` 就会红。
 */
describe('路由与底部导航一致性', () => {
  it('每个 tab 的 path 都能匹配到真实路由（而不是空白页）', () => {
    for (const tab of TABS) {
      const resolved = router.resolve(tab.path)
      expect(resolved.matched.length, `tab「${tab.label}」的路径 ${tab.path} 没有匹配到任何路由`).toBeGreaterThan(0)
      // 命中的必须是真实页面，而不是兜底路由
      expect(resolved.name, `tab「${tab.label}」的路径 ${tab.path} 命中了兜底路由`).not.toBe('not-found')
    }
  })

  it('tab 路径没有多余/缺失的层级（精确匹配注册路径）', () => {
    const paths = new Set(router.getRoutes().map((r) => r.path))
    for (const tab of TABS) {
      expect(paths.has(tab.path), `${tab.path} 不在路由表中，容易写成 /pages/xxx 这种不存在的短路径`).toBe(true)
    }
  })

  it('存在根路径重定向与未知路径兜底（避免匹配不到时一片空白）', () => {
    const paths = router.getRoutes().map((r) => r.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/:pathMatch(.*)*')
    // 未知路径应被兜底重定向到首页，而不是渲染空内容
    const resolved = router.resolve('/pages/this-does-not-exist')
    expect(resolved.matched.length).toBeGreaterThan(0)
  })

  it('关键页面路由都已注册（防止重命名后入口失效）', () => {
    const paths = new Set(router.getRoutes().map((r) => r.path))
    for (const p of [
      '/pages/index/index',
      '/pages/dashboard/index',
      '/pages/company/index',
      '/pages/agent/index',
      '/pages/profile/index',
      '/pages/leave/index',
      '/pages/leave/apply',
      '/pages/leave/approvals',
      '/pages/fee/index',
      '/pages/fee/approvals',
      '/pages/notice/index',
      '/pages/help/index',
    ]) {
      expect(paths.has(p), `${p} 未注册`).toBe(true)
    }
  })
})
