<script setup lang="ts">
/**
 * 通知中心（学员）
 *
 * 2026-09 体验修复：
 *  - 加载失败不再被 `catch (_) {}` 吞成「暂无通知」，改走 StateView 错误态 + 重试；
 *  - 空态给出「标题 + 一句解释」，不再是零信息的「暂无通知」；
 *  - 优先级/待办角标用 BaseBadge + AppIcon，替代纯色条与不可读的 11px 灰字；
 *  - 底部避让交给 App.vue（已统一加 tabbar 高度）。
 *
 * P1-3 分页：触底加载更多（page/pageSize）。
 *  - 后端只在带分页参数时才回 `hasMore`；老后端/老响应没有 hasMore 时按「没有更多」处理，
 *    绝不用「本页条数 == pageSize」去猜 —— 否则老后端会整页重复追加。
 *  - IntersectionObserver 监听底部哨兵；没有 IO 的极老 WebView 退回 scroll 监听。
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getNotices } from '@/api/notice'
import { toastIfNotNotified } from '@/utils/request'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/** 每页条数（后端上限 100，超出会被截断） */
const PAGE_SIZE = 20

const router = useRouter()
const notices = ref<any[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<unknown>(null)
const page = ref(1)
const hasMore = ref(false)

/** 底部哨兵：进入视口即加载下一页 */
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let scrollFallbackAttached = false

async function load() {
  loading.value = true
  error.value = null
  page.value = 1
  try {
    const res = await getNotices({ page: 1, pageSize: PAGE_SIZE })
    if (res.success) {
      notices.value = res.notices || []
      hasMore.value = !!res.hasMore
    } else {
      error.value = new Error('加载通知失败，请稍后重试')
      notices.value = []
      hasMore.value = false
    }
  } catch (e) {
    // 失败就是失败：以前这里 catch 掉后渲染「暂无通知」，用户会以为区队真的没发通知
    error.value = e
    notices.value = []
    hasMore.value = false
  } finally {
    loading.value = false
    void autoFill()
  }
}

/** 触底加载下一页；失败只提示、不把已加载的内容清掉 */
async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  let appended = false
  try {
    const next = page.value + 1
    const res = await getNotices({ page: next, pageSize: PAGE_SIZE })
    const list = res.notices || []
    // 按 id 去重：并发/重试导致重复请求时也不会出现重复卡片
    const seen = new Set(notices.value.map((n) => n.id))
    const fresh = list.filter((n) => !seen.has(n.id))
    // 空页，或整页都是重复（后端分页失效）→ 直接收尾，避免无限请求
    if (fresh.length === 0) {
      hasMore.value = false
      return
    }
    notices.value = [...notices.value, ...fresh]
    page.value = next
    hasMore.value = !!res.hasMore
    appended = true
  } catch (e) {
    // 失败**不自动重试**：哨兵一直在视口内的话会变成请求风暴；等用户再滚动触发
    toastIfNotNotified(e, '加载更多失败，请稍后重试')
  } finally {
    loadingMore.value = false
    if (appended) void autoFill()
  }
}

/** 追加一页后若哨兵仍在视口内，继续补一页（首屏很高时不用等用户滚动） */
async function autoFill() {
  await nextTick()
  const el = sentinel.value
  if (!el || !hasMore.value || loadingMore.value || loading.value) return
  if (el.getBoundingClientRect().top <= (window.innerHeight || 0) + 200) void loadMore()
}

function onScrollFallback() {
  const el = sentinel.value
  if (!el || !hasMore.value || loadingMore.value || loading.value) return
  if (el.getBoundingClientRect().top <= (window.innerHeight || 0) + 200) void loadMore()
}

watch(sentinel, (el) => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (!el) return
  // 单元测试环境（jsdom）与极老 WebView 都没有 IntersectionObserver，退回滚动监听
  if (typeof IntersectionObserver === 'undefined') {
    if (!scrollFallbackAttached) {
      scrollFallbackAttached = true
      window.addEventListener('scroll', onScrollFallback, { passive: true })
    }
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore()
    },
    { rootMargin: '200px 0px' },
  )
  observer.observe(el)
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (scrollFallbackAttached) window.removeEventListener('scroll', onScrollFallback)
})

onMounted(load)

function goToDetail(id: number) {
  router.push({ path: '/pages/notice/detail', query: { id: String(id) } })
}
</script>

<template>
  <div class="notice-page">
    <NavBar title="通知中心" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="notices.length === 0 && !hasMore"
      loading-text="正在加载通知…"
      empty-icon="bell"
      empty-title="本区队还没有发布通知"
      empty-description="有重要事项会在这里第一时间提醒你"
      @retry="load"
    >
      <div
        v-for="item in notices"
        :key="item.id"
        class="notice-item"
        @click="goToDetail(item.id)"
      >
        <div class="body">
          <div class="title-row">
            <div class="title">{{ item.title }}</div>
            <BaseBadge
              v-if="item.priority > 0"
              :variant="item.priority >= 2 ? 'danger' : 'warning'"
            >
              <AppIcon :name="item.priority >= 2 ? 'alert-triangle' : 'alert-circle'" :size="11" />
              {{ item.priority >= 2 ? '紧急' : '重要' }}
            </BaseBadge>
            <BaseBadge v-else-if="item.is_todo" variant="info">
              <AppIcon name="clipboard" :size="11" />
              待办
            </BaseBadge>
          </div>
          <div class="preview">{{ item.content?.replace(/<[^>]*>/g, '').slice(0, 80) || '' }}</div>
          <div class="meta">
            <span>{{ item.creator_name || '' }}</span>
            <span>{{ item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '' }}</span>
          </div>
        </div>
        <AppIcon class="chevron" name="chevron-right" :size="16" />
      </div>

      <!-- 触底加载哨兵：进入视口加载下一页；加载中网点，到底提示「没有更多了」 -->
      <div ref="sentinel" class="load-footer">
        <StateView v-if="loadingMore" slim loading />
        <p v-else-if="!hasMore && notices.length > 0" class="load-end">没有更多了</p>
      </div>
    </StateView>
  </div>
</template>

<style scoped>
.notice-page { min-height: 100vh; background: var(--color-bg); }

.notice-item {
  background: var(--color-surface);
  margin: 0 12px 8px;
  border-radius: var(--radius-md);
  padding: 16px;
  min-height: 44px;
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.notice-item:active { background: var(--color-surface-hover); }
.body { flex: 1; min-width: 0; }
.title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  margin-top: 8px;
  display: flex;
  gap: 12px;
}
.chevron { color: var(--color-text-3); flex-shrink: 0; }

/* 触底加载：哨兵 + 加载中 / 到底提示（≥44px，避免贴边误触） */
.load-footer {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.load-end {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  padding: 12px 0;
}
</style>
