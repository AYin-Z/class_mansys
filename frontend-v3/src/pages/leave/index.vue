<script setup lang="ts">
/**
 * 我的请假
 *
 * P1-3 分页：触底加载更多（page/pageSize）。
 * 分类 Tab 仍是**前端过滤已加载的页**：后端 `hasMore` 为真时继续触底加载，
 * 所以「当前分类下没有记录」只在确实翻到底之后才出现（不会误报空）。
 */
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getMyLeaves, cancelLeave } from '@/api/leave'
import type { LeaveItem } from '@/api/leave'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

/** 每页条数（后端上限 100，超出会被截断） */
const PAGE_SIZE = 20

const router = useRouter()
const userStore = useUserStore()
const leaves = ref<LeaveItem[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<unknown>(null)
const page = ref(1)
const hasMore = ref(false)
const TABS = ['全部', '待审批', '已通过', '已驳回']
const activeTab = ref(0)
/** 干部看得到审批入口：此前请假页只有"我的记录"，干部每天批假要绕到仪表盘（手册却写了「请假 → 审批」） */
const canApprove = computed(() => userStore.hasPermission('APPROVE_LEAVE'))

const filteredLeaves = computed(() => {
  if (activeTab.value === 0) return leaves.value
  const statusMap = [null, 0, 1, 2]
  return leaves.value.filter(l => l.status === statusMap[activeTab.value])
})

/** 空态只在"没有更多可加载"时出现，否则继续触底加载（分类 Tab 下的过滤是前端做的） */
const showEmpty = computed(() => filteredLeaves.value.length === 0 && !hasMore.value)

/** 底部哨兵：进入视口即加载下一页 */
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let scrollFallbackAttached = false

async function load() {
  loading.value = true
  error.value = null
  page.value = 1
  try {
    const res = await getMyLeaves({ page: 1, pageSize: PAGE_SIZE })
    if (res.success) {
      leaves.value = res.leaves || []
      hasMore.value = !!res.hasMore
    } else {
      error.value = new Error('加载请假记录失败')
      hasMore.value = false
    }
  } catch (e) {
    error.value = e
    leaves.value = []
    hasMore.value = false
  } finally {
    loading.value = false
    void autoFill()
  }
}

/** 触底加载下一页；失败只提示，已加载的记录不动 */
async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  let appended = false
  try {
    const next = page.value + 1
    const res = await getMyLeaves({ page: next, pageSize: PAGE_SIZE })
    const list = res.leaves || []
    const seen = new Set(leaves.value.map(l => l.id))
    const fresh = list.filter(l => !seen.has(l.id))
    // 空页，或整页都是重复（后端分页失效）→ 直接收尾，避免无限请求
    if (fresh.length === 0) {
      hasMore.value = false
      return
    }
    leaves.value = [...leaves.value, ...fresh]
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

/** 追加一页后若哨兵仍在视口内，继续补一页（分类 Tab 下没有匹配项时会自动往后翻） */
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

/** 切到某个分类时若当前页没有匹配项，直接往后补一页 */
watch(activeTab, () => { void autoFill() })

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (scrollFallbackAttached) window.removeEventListener('scroll', onScrollFallback)
})

onMounted(load)

function goApprovals() { router.push('/pages/leave/approvals') }

function goApply() {
  router.push('/pages/leave/apply')
}

function goDetail(id: number) {
  router.push({ path: '/pages/leave/detail', query: { id: String(id) } })
}

async function handleCancel(id: number) {
  const ok = await showConfirm('销假', '确认销假这次请假？', {
    confirmText: '确认销假',
    danger: true,
    hint: '销假后本次请假立即失效，如需再休要重新申请',
  })
  if (!ok) return
  try {
    const res = await cancelLeave(id)
    if (res.success) {
      showToast('已销假', 'success')
      leaves.value = leaves.value.map(l => l.id === id ? { ...l, is_cancelled: true } : l)
    } else {
      showToast(res.message || '销假失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '销假失败，请稍后重试')
  }
}

const statusLabel = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const statusClass = (s: number) => ['pending', 'approved', 'rejected'][s] || ''
</script>

<template>
  <div class="leave-page">
    <NavBar title="请假管理" />
    <div class="top-bar">
      <div class="tabs">
        <span v-for="(tab, i) in TABS" :key="i"
          :class="['tab', { active: activeTab === i }]"
          @click="activeTab = i">{{ tab }}</span>
      </div>
      <div class="top-actions">
        <button v-if="canApprove" class="approve-btn" @click="goApprovals">
          <AppIcon name="clipboard" :size="14" /> 审批
        </button>
        <button class="apply-btn" @click="goApply">
          <AppIcon name="plus" :size="14" /> 请假
        </button>
      </div>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="showEmpty"
      empty-icon="calendar"
      :empty-variant="activeTab === 0 ? 'default' : 'filtered'"
      :empty-title="activeTab === 0 ? '还没有请假记录' : '当前分类下没有记录'"
      :empty-description="activeTab === 0 ? '请假需要干部审批，建议提前申请' : '换个分类看看'"
      :empty-action-text="activeTab === 0 ? '发起请假' : ''"
      @retry="load"
      @empty-action="goApply"
    >
    <div v-for="item in filteredLeaves" :key="item.id" class="leave-card" @click="goDetail(item.id)">
      <div class="card-header">
        <span class="leave-type">{{ item.leave_type }}</span>
        <span :class="['status-badge', statusClass(item.status)]">{{ statusLabel(item.status) }}</span>
      </div>
      <div class="card-body">
        <div class="row"><span class="label">时间</span><span>{{ item.start_time?.slice(0, 16) }} ~ {{ item.end_time?.slice(0, 16) }}</span></div>
        <div class="row"><span class="label">原因</span><span class="reason">{{ item.reason }}</span></div>
        <div class="row" v-if="item.approval_notes"><span class="label">审批意见</span><span>{{ item.approval_notes }}</span></div>
      </div>
      <div class="card-footer">
        <span class="date">{{ item.created_at?.slice(0, 10) }}</span>
        <button v-if="item.status === 0 && !item.is_cancelled" class="cancel-btn" @click.stop="handleCancel(item.id)">销假</button>
        <span v-else-if="item.is_cancelled" class="cancelled-label">已销假</span>
      </div>
    </div>

    <!-- 触底加载哨兵：进入视口加载下一页；加载中网点，到底提示「没有更多了」 -->
    <div ref="sentinel" class="load-footer">
      <StateView v-if="loadingMore" slim loading />
      <p v-else-if="!hasMore && leaves.length > 0" class="load-end">没有更多了</p>
    </div>
    </StateView>
  </div>
</template>

<style scoped>
.leave-page { padding-bottom: var(--spacing-lg); }
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.tabs { display: flex; gap: 4px; }
.top-actions { display: flex; gap: 6px; }
.approve-btn, .apply-btn {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 34px; padding: 6px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-surface); color: var(--color-text-2);
  font-size: var(--font-size-sm); font-weight: 600; font-family: inherit; cursor: pointer;
}
.approve-btn:active, .apply-btn:active { background: var(--color-surface-hover); }
.tab {
  font-size: 13px; font-weight: 500; padding: 6px 14px;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--color-text-2); transition: all 0.15s;
}
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }
.apply-btn {
  font-size: 13px; font-weight: 600; padding: 7px 16px;
  background: var(--color-accent); color: #fff; border: none;
  border-radius: var(--radius-md); cursor: pointer;
}
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.leave-card {
  margin: 8px 12px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
  padding: 14px 16px; cursor: pointer;
}
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.leave-type { font-size: 15px; font-weight: 600; color: var(--color-text); }
.status-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.status-badge.pending { background: var(--color-warning-bg); color: var(--color-warning); }
.status-badge.approved { background: var(--color-success-bg); color: var(--color-success); }
.status-badge.rejected { background: var(--color-error-bg); color: var(--color-error); }
.card-body .row {
  display: flex; gap: 8px; font-size: 13px; color: var(--color-text-2);
  margin-bottom: 4px; line-height: 1.5;
}
.label { color: var(--color-text-3); flex-shrink: 0; min-width: 48px; }
.reason { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-footer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border);
  font-size: 12px; color: var(--color-text-3);
}
.cancel-btn {
  font-size: 12px; padding: 3px 10px; border: 1px solid var(--color-error);
  color: var(--color-error); border-radius: 4px; background: none; cursor: pointer;
}
.cancelled-label { color: var(--color-text-3); }

/* 触底加载：哨兵 + 加载中 / 到底提示 */
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
