<template>
  <div class="page">
    <custom-nav-bar title="通知管理" :showBack="true" />

    <div scroll-y class="main-scroll">
      <!-- 搜索框 -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          class="search-input"
          v-model="searchQuery"
          placeholder="搜索通知标题…"
          @input="onSearchInput"
        />
        <span v-if="searchQuery" class="search-clear" @tap="searchQuery = ''">✕</span>
      </div>

      <!-- 分类 tab -->
      <div scroll-x class="filter-scroll" show-scrollbar="false">
        <div
          v-for="tab in filterTabs"
          :key="tab.key"
          :class="['filter-tab', { active: activeTab === tab.key }]"
          @tap="activeTab = tab.key"
        >
          <span class="ft-text">{{ tab.label }}</span>
          <span class="ft-count">{{ tab.count }}</span>
        </div>
      </div>

      <!-- 统计条 -->
      <div class="stat-bar">
        <span class="stat-text">共 {{ filtered.length }} 条通知</span>
        <div class="stat-actions">
          <span v-if="activeTab === 'todo'" class="stat-link" @tap="activeTab = 'all'">查看全部</span>
        </div>
      </div>

      <!-- 列表 -->
      <div class="notice-list">
        <div v-for="item in filtered" :key="item.id" class="notice-card">
          <div class="card-top" @tap="goDetail(item)">
            <div class="card-title-row">
              <span v-if="item.is_pinned" class="tag pin">置顶</span>
              <span class="card-title">{{ item.title || '(无标题)' }}</span>
              <span v-if="item.is_todo" :class="['tag todo', { done: item.is_completed }]">
                {{ item.is_completed ? '✅已办' : '📋待办' }}
              </span>
            </div>
            <div class="card-meta">
              <span class="meta-type">{{ item.type || '日常' }}</span>
              <span class="meta-time">{{ formatDateTime(item.created_at) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <span v-if="item.is_todo" class="action-btn" @tap.stop="goCompletion(item)">📊 完成情况</span>
            <span class="action-btn" @tap.stop="editNotice(item)">✏️ 编辑</span>
            <span class="action-btn del" @tap.stop="confirmDelete(item)">🗑️ 删除</span>
          </div>
        </div>

        <div v-if="filtered.length === 0" class="empty-state">
          <span class="empty-icon">📭</span>
          <span class="empty-text">{{ searchQuery ? '没有匹配的通知' : '暂无通知' }}</span>
        </div>
      </div>

      <div class="page-spacer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onActivated, onMounted, ref } from 'vue'
import { getNotices, deleteNotice } from '@/api/notice'
const searchQuery = ref('')
const activeTab = ref('all')
const rawNotices = ref<any[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null

const filterTabs = computed(() => {
  const all = rawNotices.value.length
  const pinned = rawNotices.value.filter(n => n.is_pinned).length
  const todo = rawNotices.value.filter(n => n.is_todo).length
  return [
    { key: 'all',   label: '全部',   count: all },
    { key: 'pinned', label: '置顶',   count: pinned },
    { key: 'todo',  label: '待办',   count: todo },
  ]
})

const filtered = computed(() => {
  let list = rawNotices.value
  if (activeTab.value === 'pinned') list = list.filter(n => n.is_pinned)
  else if (activeTab.value === 'todo') list = list.filter(n => n.is_todo)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(n => n.title?.toLowerCase().includes(q))
  }
  return list
})

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {}, 200)
}

function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fetchNotices() {
  try {
    const res = await getNotices()
    if (res.success) rawNotices.value = res.notices || []
  } catch (_) {}
}

function goDetail(item: any) {
  uni.navigateTo({ url: `/pages/notice/detail?id=${item.id}` })
}

function goCompletion(item: any) {
  uni.navigateTo({ url: `/pages/dashboard/notice-completion?id=${item.id}` })
}

function editNotice(item: any) {
  uni.navigateTo({ url: `/pages/notice/publish?id=${item.id}` })
}

function confirmDelete(item: any) {
  uni.showModal({
    title: '确认删除',
    content: `删除「${item.title}」？`,
    success: async (res: any) => {
      if (res.confirm) {
        try {
          const r = await deleteNotice(item.id)
          if (r.success) {
            showToast('已删除')
            await fetchNotices()
          }
        } catch (_) { showToast('删除失败') }
      }
    }
  })
}

onShow(() => { fetchNotices() })

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.page { min-height: 100vh; background: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.search-bar {
  margin: 20rpx 28rpx 12rpx;
  display: flex; align-items: center;
  background: $surface-container-low;
  border-radius: 20rpx; padding: 0 20rpx; height: 72rpx;
}
.search-icon { font-size: 28rpx; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $on-surface; height: 100%; }
.search-clear { font-size: 28rpx; color: $on-surface-tertiary; padding: 8rpx; }

.filter-scroll { margin: 0 28rpx; white-space: nowrap; padding-bottom: 12rpx; }
.filter-tab {
  display: inline-flex; align-items: center; gap: 8rpx;
  padding: 10rpx 24rpx; margin-right: 12rpx;
  background: $surface-container-low; border-radius: 20rpx;
  transition: all $transition-fast;
  &.active {
    background: $primary;
    .ft-text { color: #fff; font-weight: 600; }
    .ft-count { background: rgba(255,255,255,0.25); color: #fff; }
  }
}
.ft-text { font-size: 26rpx; color: $on-surface; }
.ft-count {
  font-size: 20rpx; padding: 1rpx 10rpx;
  background: $outline-variant; border-radius: 10rpx; color: $on-surface-variant;
}

.stat-bar { margin: 0 28rpx 12rpx; display: flex; justify-content: space-between; align-items: center; }
.stat-text { font-size: 24rpx; color: $on-surface-tertiary; }
.stat-link { font-size: 24rpx; color: $primary; }

.notice-list { margin: 0 28rpx; }
.notice-card {
  background: #fff; border-radius: 16rpx; padding: 20rpx;
  margin-bottom: 12rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
  .card-top { margin-bottom: 12rpx; }
  .card-title-row { display: flex; align-items: center; gap: 8rpx; flex-wrap: wrap; }
  .card-title { font-size: 28rpx; font-weight: 600; color: $on-surface; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-meta { margin-top: 6rpx; display: flex; gap: 16rpx; }
  .meta-type { font-size: 22rpx; color: $primary; }
  .meta-time { font-size: 22rpx; color: $on-surface-tertiary; }
  .tag { font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 6rpx; }
  .pin { background: #fef3e2; color: #b8860b; }
  .todo { background: #e8f5e9; color: #2e7d32; }
  .todo.done { background: #e3f2fd; color: #1565c0; }
  .card-actions {
    display: flex; gap: 24rpx; padding-top: 12rpx; border-top: 1rpx solid $outline-variant;
  }
  .action-btn { font-size: 24rpx; color: $primary; &.del { color: #b3261e; } }
}

.empty-state { text-align: center; padding: 80rpx 0; }
.empty-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.empty-text { font-size: 26rpx; color: $on-surface-tertiary; }

.page-spacer { height: 32rpx; }
</style>
