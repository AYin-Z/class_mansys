/**
 * 未使用的 uni-app 生命周期 hook 空桩
 *
 * 这些 hook 在项目代码中未被引用（审计确认），但 @dcloudio/uni-app 模块导出它们，
 * 为了避免 TypeScript 引用错误，提供 No-op 导出。
 */
import { onMounted } from 'vue'

export function onInit(callback: () => void) { onMounted(callback) }
export function onReady(callback: () => void) { onMounted(callback) }
export function onUnload(callback: () => void) { /* no-op */ }
export function onPullDownRefresh(callback: () => void) { /* no-op */ }
export function onReachBottom(callback: () => void) { /* no-op */ }
export function onPageScroll(callback: (e: { scrollTop: number }) => void) { /* no-op */ }
export function onShareAppMessage(callback: () => void) { /* no-op */ }
export function onResize(callback: (e: { size: { windowWidth: number; windowHeight: number } }) => void) { /* no-op */ }
export function onTabItemTap(callback: (e: { index: number; pagePath: string; text: string }) => void) { /* no-op */ }
