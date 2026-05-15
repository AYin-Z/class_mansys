/**
 * @dcloudio/uni-app 生命周期 polyfill
 *
 * 将 uni-app 的页面生命周期 hook 映射为 Vue 3 + vue-router 的等效行为。
 * 通过 vite resolve.alias 将 `@dcloudio/uni-app` 指向此文件。
 *
 * 设计原则：
 *  - onLoad → onMounted + route.query 参数
 *  - onShow → onMounted + onActivated
 *  - onLaunch → onMounted (only meaningful in App.vue)
 *  - onHide → onUnmounted + onDeactivated
 */
import { onMounted, onActivated, onUnmounted, onDeactivated } from 'vue'
import { useRoute } from 'vue-router'

/** @dcloudio/uni-app lifecycles */
export {
  onInit,
  onReady,
  onUnload,
  onPullDownRefresh,
  onReachBottom,
  onPageScroll,
  onShareAppMessage,
  onResize,
  onTabItemTap,
} from './uni-lifecycle-stubs'

/**
 * onLoad — 组件挂载后执行，传入 route.query 作为参数
 */
export function onLoad(callback: (query: Record<string, string | undefined>) => void) {
  onMounted(() => {
    try {
      const route = useRoute()
      callback((route.query || {}) as Record<string, string | undefined>)
    } catch {
      callback({})
    }
  })
}

/**
 * onShow — 组件挂载 + 每次 keep-alive 激活时执行
 */
export function onShow(callback: () => void) {
  onMounted(callback)
  onActivated(callback)
}

/**
 * onLaunch — 应用初始化（仅 App.vue），等价 onMounted
 */
export function onLaunch(callback: () => void) {
  onMounted(callback)
}

/**
 * onHide — 组件卸载或 deactivate 时执行
 */
export function onHide(callback: () => void) {
  onUnmounted(() => { try { callback() } catch {} })
  onDeactivated(() => { try { callback() } catch {} })
}
