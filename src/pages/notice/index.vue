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
              <text class="notice-title">{{ item.title }}</text>
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
          <text class="empty-text">暂无通知</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>

    <!-- Publish Button -->
    <view class="fab-btn" v-if="canPublish" @tap="goPublish">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { isAdmin, canPublishNotice } from '@/utils/auth.js'

const currentTab = ref('all')
const canPublish = ref(false)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'urgent', label: '紧急' },
  { key: 'important', label: '重要' },
  { key: 'daily', label: '日常' }
]

const noticeList = ref([
  { id: 1, title: '关于期末考试安排的重要通知', summary: '请各位同学注意期末考试时间安排，提前做好复习准备...', time: '2026-04-09 10:00', author: '区队长', priority: 1, isPinned: true },
  { id: 2, title: '紧急：今日晚点名时间调整', summary: '因特殊原因，今日晚点名时间调整为21:30...', time: '2026-04-09 08:00', author: '辅导员', priority: 2, isPinned: true },
  { id: 3, title: '日常：本周卫生检查安排', summary: '本周三下午14:00进行宿舍卫生检查，请提前整理...', time: '2026-04-08 16:00', author: '生活副区', priority: 0, isPinned: true },
  { id: 4, title: '关于下周班会的通知', summary: '下周一晚19:00在教室召开例行班会...', time: '2026-04-06 14:00', author: '区队长', priority: 0, isPinned: false },
  { id: 5, title: '区队活动安排', summary: '本周六组织团建活动，地点待定...', time: '2026-04-05 10:30', author: '团支书', priority: 0, isPinned: false },
  { id: 6, title: '考试安排通知', summary: '期中考试将于下周开始，具体时间表已发布...', time: '2026-04-04 09:00', author: '学习副区', priority: 1, isPinned: false }
])

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

onMounted(() => {
  canPublish.value = canPublishNotice()
})
</script>

<style lang="scss" scoped>
.notice-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.tab-bar {
  display: flex;
  gap: 8rpx;
  padding: 20rpx 32rpx;
  background: #ffffff;
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
    background: #001e40;

    .tab-text {
      color: #ffffff;
    }
  }
}

.tab-text {
  font-size: 26rpx;
  font-weight: 500;
  color: #43474f;
}

.notice-list {
  padding: 24rpx 32rpx;
}

.notice-card {
  position: relative;
  display: flex;
  background: #ffffff;
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

  &.accent-urgent { background: #460002; }
  &.accent-important { background: #001e40; }
  &.accent-daily { background: #466270; }
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

.notice-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  color: #191c1e;
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

  &.urgent { background: rgba(70,0,2,0.08); color: #460002; }
  &.important { background: rgba(0,30,64,0.06); color: #001e40; }
  &.daily { background: rgba(70,98,112,0.08); color: #466270; }
}

.notice-summary {
  font-size: 24rpx;
  color: #43474f;
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
  color: #c3c6d1;
}

.notice-author {
  font-size: 22rpx;
  color: #c3c6d1;
}

.empty-state {
  padding: 80rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: #c3c6d1;
}

.fab-btn {
  position: fixed;
  right: 32rpx;
  bottom: calc(120rpx + env(safe-area-inset-bottom));
  width: 104rpx;
  height: 104rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
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
  color: #ffffff;
  line-height: 1;
}
</style>