<template>
  <view class="page">
    <custom-nav-bar title="通知管理" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <!-- 搜索框 -->
      <view class="search-bar">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="searchQuery"
          placeholder="搜索通知标题…"
          @input="onSearchInput"
        />
        <text v-if="searchQuery" class="search-clear" @tap="searchQuery = ''; applyFilter()">✕</text>
      </view>

      <!-- 分类 tab -->
      <scroll-view scroll-x class="filter-scroll" show-scrollbar="false">
        <view
          v-for="tab in filterTabs"
          :key="tab.key"
          :class="['filter-tab', { active: activeTab === tab.key }]"
          @tap="activeTab = tab.key; applyFilter()"
        >
          <text class="ft-text">{{ tab.label }}</text>
          <text v-if="tab.count !== undefined" class="ft-count">{{ tab.count }}</text>
        </view>
      </scroll-view>

      <!-- 统计条 -->
      <view class="stat-bar">
        <text class="stat-text">共 {{ filtered.length }} 条通知</text>
        <view class="stat-actions">
          <text v-if="activeTab === 'todo'" class="stat-link" @tap="showAllTodo">查看全部</text>
        </view>
      </view>

      <!-- 列表 -->
      <view class="notice-list">
        <view v-for="item in filtered" :key="item.id" class="notice-card">
          <view class="card-top" @tap="goDetail(item)">
            <view class="card-title-row">
              <text v-if="item.is_pinned" class="tag pin">置顶</text>
              <text class="card-title">{{ item.title || '(无标题)' }}</text>
              <text v-if="item.is_todo" :class="['tag todo', { done: item.is_completed }]">
                {{ item.is_completed ? '✅已办' : '📋待办' }}
              </text>
            </view>
            <view class="card-meta">
              <text class="meta-type">{{ item.type || '日常' }}</text>
              <text class="meta-time">{{ formatDateTime(item.created_at) }}</text>
            </view>
          </view>

          <view class="card-actions">
            <text v-if="item.is_todo" class="action-btn" @tap.stop="showCompletion(item)">📊 完成情况</text>
            <text class="action-btn" @tap.stop="editNotice(item)">✏️ 编辑</text>
            <text class="action-btn del" @tap.stop="confirmDelete(item)">🗑️ 删除</text>
          </view>
        </view>

        <view v-if="filtered.length === 0" class="empty-state">
          <text class="empty-icon">📭</text>
          <text class="empty-text">{{ searchQuery ? '没有匹配的通知' : '暂无通知' }}</text>
        </view>
      </view>

      <view class="page-spacer"></view>
    </scroll-view>

    <!-- 完成名单弹窗 -->
    <view v-if="showModal" class="modal-overlay" @tap="closeModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">{{ modalNotice?.title }}</text>
          <text class="modal-close" @tap="closeModal">✕</text>
        </view>
        <view class="modal-summary">已完成 {{ modalData.completed.length }} / {{ modalData.total }} 人</view>
        <scroll-view scroll-y class="modal-scroll">
          <view v-for="c in modalData.completed" :key="c.id" class="completion-row done">
            <text class="cr-name">{{ c.name }}</text>
            <text class="cr-id">{{ c.student_id }}</text>
            <text class="cr-status">✅ 已完成</text>
          </view>
          <view v-for="p in modalData.pending" :key="p.id" class="completion-row pending">
            <text class="cr-name">{{ p.name }}</text>
            <text class="cr-id">{{ p.student_id }}</text>
            <text class="cr-status">⏳ 未完成</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getNotices, deleteNotice, getTodoCompletion } from '@/api/notice'

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

  // Tab filter
  if (activeTab.value === 'pinned') {
    list = list.filter(n => n.is_pinned)
  } else if (activeTab.value === 'todo') {
    list = list.filter(n => n.is_todo)
  }

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(n => n.title?.toLowerCase().includes(q))
  }

  return list
})

function applyFilter() {
  // reactive filter already applied via computed
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {}, 200)
}

function showAllTodo() {
  activeTab.value = 'all'
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
            uni.showToast({ title: '已删除', icon: 'success' })
            await fetchNotices()
          }
        } catch (_) { uni.showToast({ title: '删除失败', icon: 'none' }) }
      }
    }
  })
}

// Completion modal
const showModal = ref(false)
const modalNotice = ref<any>(null)
const modalData = ref<{ completed: any[]; pending: any[]; total: number }>({
  completed: [], pending: [], total: 0
})

async function showCompletion(item: any) {
  modalNotice.value = item
  showModal.value = true
  try {
    const res = await getTodoCompletion(item.id)
    if (res.success) {
      modalData.value = {
        completed: res.completed || [],
        pending: res.pending || [],
        total: res.total || 0
      }
    }
  } catch (_) { uni.showToast({ title: '获取失败', icon: 'none' }) }
}

function closeModal() {
  showModal.value = false
  modalNotice.value = null
}

onShow(() => { fetchNotices() })
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.page {
  min-height: 100vh;
  background: $surface;
}
.main-scroll {
  height: calc(100vh - 88rpx);
}

/* Search */
.search-bar {
  margin: 20rpx 28rpx 12rpx;
  display: flex;
  align-items: center;
  background: $surface-container-low;
  border-radius: 20rpx;
  padding: 0 20rpx;
  height: 72rpx;
}
.search-icon { font-size: 28rpx; margin-right: 12rpx; }
.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $on-surface;
  height: 100%;
}
.search-clear {
  font-size: 28rpx;
  color: $on-surface-tertiary;
  padding: 8rpx;
}

/* Filter tabs */
.filter-scroll {
  margin: 0 28rpx;
  white-space: nowrap;
  padding-bottom: 12rpx;
}
.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 24rpx;
  margin-right: 12rpx;
  background: $surface-container-low;
  border-radius: 20rpx;
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
  background: $outline-variant; border-radius: 10rpx;
  color: $on-surface-variant;
}

/* Stat bar */
.stat-bar {
  margin: 0 28rpx 12rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stat-text { font-size: 24rpx; color: $on-surface-tertiary; }
.stat-link { font-size: 24rpx; color: $primary; }

/* Notice list */
.notice-list { margin: 0 28rpx; }

.notice-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);

  .card-top { margin-bottom: 12rpx; }
  .card-title-row {
    display: flex; align-items: center; gap: 8rpx; flex-wrap: wrap;
  }
  .card-title {
    font-size: 28rpx; font-weight: 600; color: $on-surface;
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .card-meta {
    margin-top: 6rpx; display: flex; gap: 16rpx;
  }
  .meta-type {
    font-size: 22rpx; color: $primary;
  }
  .meta-time {
    font-size: 22rpx; color: $on-surface-tertiary;
  }
  .tag {
    font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 6rpx;
    &.pin { background: #fef3e2; color: #b8860b; }
    &.todo { background: #e8f5e9; color: #2e7d32; }
    &.todo.done { background: #e3f2fd; color: #1565c0; }
  }
  .card-actions {
    display: flex; gap: 24rpx; padding-top: 12rpx;
    border-top: 1rpx solid $outline-variant;
  }
  .action-btn {
    font-size: 24rpx; color: $primary;
    &.del { color: #b3261e; }
  }
}

.empty-state {
  text-align: center; padding: 80rpx 0;
  .empty-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
  .empty-text { font-size: 26rpx; color: $on-surface-tertiary; }
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
}
.modal-content {
  width: 640rpx; max-height: 80vh;
  background: #fff; border-radius: 24rpx; padding: 28rpx;
  display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx;
  .modal-title { font-size: 32rpx; font-weight: 700; color: $on-surface; flex: 1; }
  .modal-close { font-size: 36rpx; color: $on-surface-tertiary; padding: 8rpx; }
}
.modal-summary { font-size: 26rpx; color: $on-surface-variant; margin-bottom: 16rpx; }
.modal-scroll { max-height: 60vh; }
.completion-row {
  display: flex; align-items: center; gap: 12rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $outline-variant;
  &.done .cr-status { color: #2e7d32; }
  &.pending .cr-status { color: #bf6b00; }
  .cr-name { font-size: 28rpx; font-weight: 600; color: $on-surface; width: 120rpx; }
  .cr-id { font-size: 24rpx; color: $on-surface-tertiary; flex: 1; }
  .cr-status { font-size: 24rpx; }
}

.page-spacer { height: 32rpx; }
</style>
