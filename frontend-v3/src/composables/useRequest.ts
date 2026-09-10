import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'

export interface UseRequestOptions {
  /** 是否在组件挂载后立即执行一次 run() */
  immediate?: boolean
}

export interface UseRequestResult<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<unknown>
  run: () => Promise<T | null>
}

/**
 * 极简请求状态封装：把一次异步请求的 data / loading / error 收敛到一处。
 * 仅做状态管理，不侵入 request 工具层的业务语义。
 */
export function useRequest<T>(fn: () => Promise<T>, options: UseRequestOptions = {}): UseRequestResult<T> {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)

  const run = async (): Promise<T | null> => {
    loading.value = true
    error.value = null
    try {
      data.value = await fn()
      return data.value
    } catch (e) {
      error.value = e
      throw e
    } finally {
      loading.value = false
    }
  }

  if (options.immediate) {
    onMounted(() => {
      run().catch(() => {})
    })
  }

  return { data: data as Ref<T | null>, loading, error, run }
}
