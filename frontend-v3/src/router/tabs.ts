/**
 * 底部导航配置
 *
 * 2026-09-11 事故：重写 TabBar 时把路径写成了 `/pages/index`，
 * 而路由注册的是 `/pages/index/index`。点任何一个 tab 都匹配不到路由，
 * 结果「内容区空白 + TabBar 正常 + 没有任何报错」——排查了很久。
 *
 * 因此：
 *  1. tab 路径集中在这里，`src/router/__tests__/routes.spec.ts` 会断言
 *     每个 tab 路径都能在真实路由表里 resolve 到组件（回归护栏）；
 *  2. 路由表加了 catch-all，未知路径会重定向到首页并在诊断通道留痕，
 *     不会再出现"点了没反应且一片空白"。
 */
export interface TabItem {
  key: string
  label: string
  icon: string
  /** 必须与 src/router/index.ts 中注册的 path 完全一致 */
  path: string
  /** 需要该权限才显示（服务端权限矩阵优先） */
  perm?: string
  /** 仅管理员可见 */
  adminOnly?: boolean
  /** 是否显示待办/未读角标 */
  badge?: boolean
}

export const TABS: TabItem[] = [
  { key: 'home', label: '首页', icon: 'home', path: '/pages/index/index', badge: true },
  { key: 'dashboard', label: '待办', icon: 'dashboard', path: '/pages/dashboard/index', badge: true },
  { key: 'company', label: '中队', icon: 'building', path: '/pages/company/index', perm: 'VIEW_COMPANY' },
  { key: 'agent', label: '助手', icon: 'sparkles', path: '/pages/agent/index' },
  { key: 'profile', label: '我的', icon: 'user', path: '/pages/profile/index' },
]
