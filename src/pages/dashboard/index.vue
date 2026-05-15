<template>
  <view class="dash-page">
    <custom-nav-bar title="班级仪表盘" />

    <scroll-view scroll-y class="main-scroll">
      <!-- Header -->
      <view class="hero-strip">
        <text class="hero-title">📊 班级仪表盘</text>
        <text class="hero-sub">{{ roleLabel }} · 管理班级事务</text>
      </view>

      <!-- 通知管理 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">📋 通知管理</text>
          <text class="section-count" @tap="fetchNotices">共 {{ notices.length }} 条</text>
        </view>

        <view v-for="item in notices" :key="item.id" class="notice-card">
          <view class="card-top">
            <view class="card-title-row">
              <text v-if="item.is_pinned" class="pin-tag">置顶</text>
              <text class="card-title">{{ item.title || '(无标题)' }}</text>
              <text v-if="item.is_todo" :class="['todo-tag', { done: item.is_completed }]">
                {{ item.is_completed ? '✅已办' : '📋待办' }}
              </text>
            </view>
            <text class="card-time">{{ formatDateTime(item.created_at) }}</text>
          </view>

          <view class="card-actions">
            <text v-if="item.is_todo" class="action-link todo-action" @tap="showCompletion(item)">📊 完成情况</text>
            <text class="action-link edit-action" @tap="editNotice(item)">✏️ 编辑</text>
            <text class="action-link del-action" @tap="confirmDelete(item)">🗑️ 删除</text>
          </view>
        </view>

        <view v-if="notices.length === 0" class="empty-state">
          <text class="empty-text">暂无通知</text>
        </view>
      </view>

      <!-- 管理入口 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">⚙️ 管理入口</text>
        </view>
        <view class="grid-3col">
          <view class="grid-item" @tap="goPage('/pages/leave/approve')">
            <text class="gi-icon">✅</text>
            <text class="gi-label">待办审批</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/fee/index')">
            <text class="gi-icon">💰</text>
            <text class="gi-label">班费管理</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/admin/members')">
            <text class="gi-icon">👥</text>
            <text class="gi-label">成员管理</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/vote/index')">
            <text class="gi-icon">🗳️</text>
            <text class="gi-label">投票管理</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/notice/publish')">
            <text class="gi-icon">📢</text>
            <text class="gi-label">发布通知</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/album/index')">
            <text class="gi-icon">📷</text>
            <text class="gi-label">相册管理</text>
          </view>
        </view>
      </view>

      <view class="page-spacer"></view>
    </scroll-view>

    <!-- 完成名单弹窗 -->
    <view v-if="showCompletionModal" class="modal-overlay" @tap="closeModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">📊 {{ completionNotice?.title }}</text>
          <text class="modal-close" @tap="closeModal">✕</text>
        </view>
        <view class="modal-summary">已完成 {{ completionData.completed.length }} / {{ completionData.total }} 人</view>
        <scroll-view scroll-y class="modal-scroll">
          <view v-for="c in completionData.completed" :key="c.id" class="completion-row done">
            <text class="cr-name">{{ c.name }}</text>
            <text class="cr-id">{{ c.student_id }}</text>
            <text class="cr-status">✅ 已完成</text>
          </view>
          <view v-for="p in completionData.pending" :key="p.id" class="completion-row pending">
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
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getNotices, deleteNotice, getTodoCompletion } from '@/api/notice'
import { getRoleLabel } from '@/constants/roles'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const notices = ref<any[]>([])
const loading = ref(false)

const roleLabel = computed(() => getRoleLabel(store.user?.role))

function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fetchNotices() {
  loading.value = true
  try {
    const res = await getNotices()
    if (res.success) notices.value = res.notices || []
  } catch (_) {}
  loading.value = false
}

function goPage(url: string) {
  uni.navigateTo({ url })
}

// 删除
function confirmDelete(item: any) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除「${item.title}」？`,
    success: async (res: any) => {
      if (res.confirm) {
        try {
          const r = await deleteNotice(item.id)
          if (r.success) {
            uni.showToast({ title: '已删除', icon: 'success' })
            await fetchNotices()
          }
        } catch (_) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

// 编辑
function editNotice(item: any) {
  uni.navigateTo({
    url: `/pages/notice/publish?id=${item.id}`
  })
}

// 完成名单弹窗
const showCompletionModal = ref(false)
const completionNotice = ref<any>(null)
const completionData = ref<{ completed: any[]; pending: any[]; total: number }>({
  completed: [], pending: [], total: 0
})

async function showCompletion(item: any) {
  completionNotice.value = item
  showCompletionModal.value = true
  try {
    const res = await getTodoCompletion(item.id)
    if (res.success) {
      completionData.value = {
        completed: res.completed || [],
        pending: res.pending || [],
        total: res.total || 0
      }
    }
  } catch (_) {
    uni.showToast({ title: '获取完成情况失败', icon: 'none' })
  }
}

function closeModal() {
  showCompletionModal.value = false
  completionNotice.value = null
}

onShow(() => {
  fetchNotices()
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.dash-page {
  min-height: 100vh;
  background: $surface;
}

.main-scroll {
  height: calc(100vh - 110rpx);
}

.hero-strip {
  margin: 24rpx 32rpx 20rpx;
  padding: 32rpx 28rpx;
  background: $gradient-primary;
  border-radius: 24rpx;

  .hero-title {
    font-size: 40rpx;
    font-weight: 800;
    color: #fff;
    letter-spacing: 2rpx;
  }
  .hero-sub {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.8);
  }
}

.section {
  margin: 0 28rpx 28rpx;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .section-title {
      font-size: 32rpx;
      font-weight: 700;
      color: $on-surface;
    }
    .section-count {
      font-size: 22rpx;
      color: $primary;
    }
  }
}

.notice-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  .card-top {
    margin-bottom: 12rpx;
  }
  .card-title-row {
    display: flex;
    align-items: center;
    gap: 8rpx;
    flex-wrap: wrap;
  }
  .card-title {
    font-size: 28rpx;
    font-weight: 600;
    color: $on-surface;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pin-tag {
    font-size: 20rpx;
    padding: 2rpx 10rpx;
    background: #fef3e2;
    color: #b8860b;
    border-radius: 6rpx;
  }
  .todo-tag {
    font-size: 20rpx;
    padding: 2rpx 10rpx;
    background: #e8f5e9;
    color: #2e7d32;
    border-radius: 6rpx;
    &.done {
      background: #e3f2fd;
      color: #1565c0;
    }
  }
  .card-time {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $on-surface-tertiary;
  }
  .card-actions {
    display: flex;
    gap: 24rpx;
    padding-top: 12rpx;
    border-top: 1rpx solid $outline-variant;
  }
  .action-link {
    font-size: 24rpx;
    &.todo-action { color: #2e7d32; }
    &.edit-action { color: $primary; }
    &.del-action { color: #b3261e; }
  }
}

.grid-3col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;

  .grid-item {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx 12rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

    .gi-icon { font-size: 48rpx; }
    .gi-label {
      font-size: 24rpx;
      font-weight: 600;
      color: $on-surface;
    }
  }
}

.empty-state {
  text-align: center;
  padding: 48rpx 0;
  .empty-text { font-size: 26rpx; color: $on-surface-tertiary; }
}

// Modal
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  width: 640rpx;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
  .modal-title { font-size: 32rpx; font-weight: 700; color: $on-surface; flex: 1; }
  .modal-close { font-size: 36rpx; color: $on-surface-tertiary; padding: 8rpx; }
}
.modal-summary {
  font-size: 26rpx;
  color: $on-surface-variant;
  margin-bottom: 16rpx;
}
.modal-scroll {
  max-height: 60vh;
}
.completion-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $outline-variant;
  &.done { .cr-status { color: #2e7d32; } }
  &.pending { .cr-status { color: #bf6b00; } }
  .cr-name { font-size: 28rpx; font-weight: 600; color: $on-surface; width: 120rpx; }
  .cr-id { font-size: 24rpx; color: $on-surface-tertiary; flex: 1; }
  .cr-status { font-size: 24rpx; }
}

.page-spacer { height: 32rpx; }
</style>
