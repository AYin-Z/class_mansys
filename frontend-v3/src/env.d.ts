/// <reference types="vite/client" />

// 构建时注入的应用版本号（来自 package.json，见 vite.config.ts 的 define）
declare const __APP_VERSION__: string
// 构建号（版本+时间戳），见 vite.config.ts 的 define
declare const __APP_BUILD_ID__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
