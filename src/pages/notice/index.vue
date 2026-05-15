<template>
  <view class="notice-page">
    <custom-nav-bar title="通知管理" />

    <scroll-view scroll-y class="main-scroll">
      <!-- Tab Filter -->
      <view class="tab-bar">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-item', { active: currentTab === tab.key }]"
          @tap="currentTab = tab.key"
        >
          <text class="tab-text">{{ tab.label }}</text>
        </view>
      </view>

      <!-- Notice List -->
      <view class="notice-list">
        <view
          v-for="item in filteredNotices"
          :key="item.id"
          class="notice-card"
          @tap="goDetail(item)"
        >
          <view :class="['card-accent', priorityAccent(item.priority)]"></view>
          <view class="card-body">
            <view class="card-top">
              <view class="title-row">
                <text v-if="item.is_read === false" class="unread-dot">●</text>
                <text class="notice-title">{{ item.title }}</text>
              </view>
              <view :class="['priority-tag', priorityClass(item.priority)]">
                {{ priorityLabel(item.priority) }}
              </view>
            </view>
            <text class="notice-summary">{{ item.summary }}</text>
            <view class="card-footer">
              <text class="notice-time">{{ item.time }}</text>
              <text class="notice-author">{{ item.author }}</text>
            </view>
          </view>
        </view>

        <view v-if="filteredNotices.length === 0" class="empty-state">
          <text class="empty-icon">📭</text>
          <text class="empty-title">{{ loading ? '加载中…' : '暂无通知' }}</text>
          <text class="empty-hint">
            {{ loading ? '正在从后端获取最新通知' : (canPublish ? '点击右下角按钮发布第一条通知' : '当有新的通知时会显示在这里') }}
          </text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>

    <!-- Publish Button -->
    <view class="fab-btn" v-if="canPublish" @tap="goPublish">
      <text class="fab-icon">+</text>
    </view>

    <custom-tab-bar current="notice" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isAdmin, canPublishNotice } from '@/utils/auth.js'
import { getNotices } from '@/api/notice'
import { hasBackendToken } from '@/utils/request'

const currentTab = ref('all')
const canPublish = ref(false)
const loading = ref(false)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'urgent', label: '紧急' },
  { key: 'important', label: '重要' },
  { key: 'daily', label: '日常' }
]

const noticeList = ref([])

const filteredNotices = computed(() => {
  if (currentTab.value === 'all') return noticeList.value
  const map = { urgent: 2, important: 1, daily: 0 }
  return noticeList.value.filter(n => n.priority === map[currentTab.value])
})

function priorityClass(p) {
  if (p === 2) return 'urgent'
  if (p === 1) return 'important'
  return 'daily'
}

function priorityAccent(p) {
  if (p === 2) return 'accent-urgent'
  if (p === 1) return 'accent-important'
  return 'accent-daily'
}

function priorityLabel(p) {
  if (p === 2) return '紧急'
  if (p === 1) return '重要'
  return '日常'
}

function goDetail(item) {
  uni.navigateTo({ url: `/pages/notice/detail?id=${item.id}` })
}

function goPublish() {
  uni.navigateTo({ url: '/pages/notice/publish' })
}

async function fetchNotices() {
  if (!hasBackendToken()) {
    console.warn('未登录后端，跳过加载通知数据')
    return
  }

  loading.value = true
  try {
    const res = await getNotices()
    if (res.success) {
      noticeList.value = (res.notices || []).map(n => ({
        ...n,
        summary: n.summary || (n.content ? n.content.substring(0, 50) + '...' : ''),
        time: n.created_at ? n.created_at.substring(0, 16).replace('T', ' ') : '',
        author: n.creator_name || '管理员',
        isPinned: n.is_pinned || false
      }))
    }
  } catch (error) {
    console.error('获取通知失败:', error)
    uni.showToast({ title: '获取通知失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  canPublish.value = canPublishNotice()
  fetchNotices()
})

onShow(() => {
  canPublish.value = canPublishNotice()
  fetchNotices()
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.notice-page {
  min-height: 100vh;
  background-color: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.tab-bar {
  display: flex;
  gap: 8rpx;
  padding: 20rpx 32rpx;
  background: $surface-container-lowest;
}

.tab-item {
  flex: 1;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 34rpx;
  transition: all 0.2s;

  &.active {
    background: $primary;

    .tab-text {
      color: $on-primary;
    }
  }
}

.tab-text {
  font-size: 26rpx;
  font-weight: 500;
  color: $on-surface-variant;
}

.notice-list {
  padding: 24rpx 32rpx;
}

.notice-card {
  position: relative;
  display: flex;
  background: $surface-container-lowest;
  border-radius: 18rpx;
  overflow: hidden;
  margin-bottom: 16rpx;

  &:active {
    opacity: 0.85;
  }
}

.card-accent {
  width: 10rpx;
  flex-shrink: 0;

  &.accent-urgent { background: $tertiary; }
  &.accent-important { background: $primary; }
  &.accent-daily { background: $secondary; }
}

.card-body {
  flex: 1;
  padding: 24rpx;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex: 1;
  min-width: 0;
}

.unread-dot {
  color: #001e40;
  font-size: 20rpx;
  flex-shrink: 0;
  line-height: 1;
}

.notice-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  color: $on-surface;
  flex: 1;
  line-height: 1.4;
}

.priority-tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;

  &.urgent { background: rgba($tertiary,0.08); color: $tertiary; }
  &.important { background: rgba($primary,0.06); color: $primary; }
  &.daily { background: rgba($secondary,0.08); color: $secondary; }
}

.notice-summary {
  font-size: 24rpx;
  color: $on-surface-variant;
  line-height: 1.5;
  margin-bottom: 16rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.notice-time {
  font-size: 22rpx;
  color: $outline-variant;
}

.notice-author {
  font-size: 22rpx;
  color: $outline-variant;
}

.empty-state {
  margin: 80rpx 32rpx 0;
  padding: 60rpx 32rpx;
  text-align: center;
  background: $surface-container-lowest;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.empty-icon {
  font-size: 72rpx;
  line-height: 1;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $on-surface-variant;
}

.empty-hint {
  font-size: 24rpx;
  color: $outline-variant;
  line-height: 1.5;
}

.fab-btn {
  position: fixed;
  right: 32rpx;
  /* 140rpx tab-bar + 40rpx buffer */
  bottom: calc(180rpx + env(safe-area-inset-bottom));
  width: 104rpx;
  height: 104rpx;
  background: $gradient-primary;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.3);
  z-index: 99;

  &:active {
    transform: scale(0.95);
  }
}

.fab-icon {
  font-size: 48rpx;
  color: $on-primary;
  line-height: 1;
}
</style>