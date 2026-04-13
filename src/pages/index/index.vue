<template>
  <view class="home-page">
    <custom-nav-bar title="区队管理系统" />
    <scroll-view scroll-y class="main-scroll">
      <!-- Header Section -->
      <view class="header-section">
        <view class="header-card">
          <view class="user-info">
            <image class="avatar" src="/static/images/avatar.png" mode="aspectFill" />
            <view class="user-details">
              <text class="username">{{ userName || '未登录' }}</text>
              <text class="role-badge">{{ userRole || '学员' }}</text>
            </view>
          </view>
          <view class="date-section">
            <text class="current-date">{{ currentDate }}</text>
            <text class="greeting">{{ greeting }}</text>
          </view>
        </view>
      </view>

      <!-- Quick Actions -->
      <view class="quick-actions">
        <view class="section-header">
          <text class="section-title">快捷功能</text>
          <text class="section-sub">快速访问常用功能</text>
        </view>
        <view class="actions-grid">
          <view v-for="action in actions" :key="action.key" class="action-card" @tap="goToPage(action)">
            <view class="action-icon">{{ action.icon }}</view>
            <text class="action-label">{{ action.label }}</text>
          </view>
        </view>
      </view>

      <!-- System Status -->
      <view class="system-status">
        <view class="section-header">
          <text class="section-title">系统状态</text>
          <text class="section-sub">实时数据</text>
        </view>
        <view class="status-grid">
          <view v-for="stat in statusData" :key="stat.key" class="status-card">
            <text class="stat-value">{{ stat.value }}</text>
            <text class="stat-label">{{ stat.label }}</text>
          </view>
        </view>
      </view>

      <!-- Recent Updates -->
      <view class="recent-updates">
        <view class="section-header">
          <text class="section-title">最新动态</text>
          <text class="section-sub">区队最新通知</text>
        </view>
        <view v-for="update in recentUpdates" :key="update.id" class="update-card" @tap="goToNoticeDetail(update)">
          <view class="update-icon" :class="update.type">{{ update.icon }}</view>
          <view class="update-content">
            <text class="update-title">{{ update.title }}</text>
            <text class="update-time">{{ update.time }}</text>
          </view>
          <text class="update-arrow">›</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>

    <!-- Floating Action Button -->
    <view class="fab" @tap="goToPublish">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const userName = ref('')
const userRole = ref('')

const currentDate = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekDay = weekDays[now.getDay()]
  return `${year}年${month}月${day}日 ${weekDay}`
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了，注意休息'
  if (hour < 12) return '早上好，开始新的一天'
  if (hour < 18) return '下午好，继续加油'
  return '晚上好，今天辛苦了'
})

const actions = [
  { key: 'leave', icon: '🏥', label: '请假销假', url: '/pages/leave/index' },
  { key: 'fee', icon: '�', label: '班费管理', url: '/pages/fee/index' },
  { key: 'notice', icon: '�', label: '通知管理', url: '/pages/notice/index' },
  { key: 'homework', icon: '�', label: '作业管理', url: '/pages/homework/index' },
  { key: 'points', icon: '⭐', label: '积分中心', url: '/pages/points/index' },
  { key: 'suggestion', icon: '💡', label: '建议箱', url: '/pages/suggestion/index' },
  { key: 'challenge', icon: '🏆', label: '擂台挑战', url: '/pages/challenge/index' },
  { key: 'lottery', icon: '🎁', label: '抽奖活动', url: '/pages/lottery/index' }
]

const statusData = [
  { key: 'attendance', value: '96%', label: '出勤率' },
  { key: 'fee', value: '¥1,280', label: '班费余额' },
  { key: 'leave', value: '2', label: '请假中' },
  { key: 'notice', value: '5', label: '未读通知' }
]

const recentUpdates = [
  { id: 1, title: '关于开展春季体能训练的通知', time: '2026-04-09 10:00', type: 'important', icon: '📢' },
  { id: 2, title: '班费使用申请审批结果', time: '2026-04-08 16:30', type: 'normal', icon: '💰' },
  { id: 3, title: '下周课程表已更新', time: '2026-04-07 14:00', type: 'normal', icon: '📅' }
]

onMounted(() => {
  const storedUser = uni.getStorageSync('userInfo')
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser)
      userName.value = user.name || '未登录'
      userRole.value = user.role || '学员'
    } catch (e) {}
  }
})

function goToPage(action) {
  if (action.url) {
    uni.navigateTo({ url: action.url })
  }
}

function goToNoticeDetail(update) {
  uni.navigateTo({ url: '/pages/notice/detail' })
}

function goToPublish() {
  uni.navigateTo({ url: '/pages/notice/publish' })
}
</script>

<style lang="scss" scoped>
@import "../../uni.scss";

.home-page {
  min-height: 100vh;
  background: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

/* Header Section */
.header-section {
  padding: $spacing-md;
}

.header-card {
  @include actionable-card;
  background: $gradient-primary;
  color: #ffffff;
}

.user-info {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-bottom: $spacing-md;
}

.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.25);
}

.user-details {
  flex: 1;
}

.username {
  display: block;
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: $font-weight-bold;
  margin-bottom: $spacing-xs;
}

.role-badge {
  display: inline-block;
  padding: 4rpx 16rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: $radius-full;
  font-size: 20rpx;
  font-weight: $font-weight-medium;
}

.date-section {
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
  padding-top: $spacing-md;
}

.current-date {
  display: block;
  font-size: 24rpx;
  font-weight: $font-weight-medium;
  margin-bottom: $spacing-xs;
}

.greeting {
  display: block;
  font-size: 20rpx;
  opacity: 0.8;
}

/* Quick Actions */
.quick-actions {
  padding: $spacing-md;
}

.section-header {
  margin-bottom: $spacing-md;
}

.section-title {
  display: block;
  font-family: $font-display;
  font-size: $headline-sm;
  font-weight: $font-weight-semibold;
  color: $on-surface;
  margin-bottom: $spacing-xs;
}

.section-sub {
  display: block;
  font-size: $body-md;
  color: $on-surface-variant;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-sm;
}

.action-card {
  @include actionable-card;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-sm;
  text-align: center;
}

.action-icon {
  font-size: 48rpx;
}

.action-label {
  font-size: $body-md;
  font-weight: $font-weight-medium;
  color: $on-surface;
  line-height: 1.2;
}

/* System Status */
.system-status {
  padding: 0 $spacing-md $spacing-md;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
}

.status-card {
  @include actionable-card;
  text-align: center;
  padding: $spacing-md;
}

.stat-value {
  display: block;
  font-family: $font-display;
  font-size: $display-lg;
  font-weight: $font-weight-bold;
  color: $primary;
  margin-bottom: $spacing-xs;
  line-height: 1;
}

.stat-label {
  display: block;
  font-size: $body-md;
  color: $on-surface-variant;
}

/* Recent Updates */
.recent-updates {
  padding: 0 $spacing-md;
}

.update-card {
  @include actionable-card;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.update-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
  
  &.important {
    background: rgba(70, 0, 2, 0.06);
  }
  
  &.normal {
    background: rgba(0, 30, 64, 0.06);
  }
}

.update-content {
  flex: 1;
  min-width: 0;
}

.update-title {
  display: block;
  font-size: $body-md;
  font-weight: $font-weight-medium;
  color: $on-surface;
  margin-bottom: $spacing-xs;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-time {
  display: block;
  font-size: $label-sm;
  color: $on-surface-tertiary;
}

.update-arrow {
  font-size: 36rpx;
  color: $on-surface-tertiary;
  flex-shrink: 0;
}

/* Floating Action Button */
.fab {
  position: fixed;
  right: $spacing-md;
  bottom: calc(120rpx + env(safe-area-inset-bottom));
  width: 104rpx;
  height: 104rpx;
  background: $gradient-primary;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-floating;
  z-index: $z-index-floating;
  transition: transform $transition-fast, box-shadow $transition-fast;
  
  &:active {
    transform: scale(0.95);
    box-shadow: $shadow-ambient;
  }
}

.fab-icon {
  font-size: 48rpx;
  color: #ffffff;
  line-height: 1;
  font-weight: $font-weight-light;
}
</style>