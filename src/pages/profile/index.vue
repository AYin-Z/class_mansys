<template>
  <view class="profile-page">
    <custom-nav-bar title="我的" />
    <scroll-view scroll-y class="main-scroll">
      <!-- Profile Header -->
      <view class="profile-header">
        <view class="header-bg"></view>
        <view class="user-info">
          <image class="avatar" src="/static/images/avatar.png" mode="aspectFill" />
          <text class="username">{{ userInfo.name || '未登录' }}</text>
          <text class="role-badge">{{ userInfo.role || '学员' }}</text>
        </view>
        <view class="stats-row">
          <view class="stat-item">
            <text class="stat-val">{{ myPoints }}</text>
            <text class="stat-label">积分</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-val">{{ attendance }}</text>
            <text class="stat-label">出勤率</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-val">{{ rank }}</text>
            <text class="stat-label">排名</text>
          </view>
        </view>
      </view>

      <!-- Menu Sections -->
      <view class="menu-section">
        <view v-for="group in menuGroups" :key="group.title" class="menu-group">
          <text class="group-title">{{ group.title }}</text>
          <view v-for="item in group.items" :key="item.key" class="menu-item" @tap="goPage(item)">
            <text class="menu-icon">{{ item.icon }}</text>
            <text class="menu-label">{{ item.label }}</text>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- Settings Section -->
      <view class="settings-section">
        <text class="group-title">设置</text>
        <view class="menu-item" @tap="goToSettings">
          <text class="menu-icon">⚙️</text>
          <text class="menu-label">系统设置</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goToAbout">
          <text class="menu-icon">ℹ️</text>
          <text class="menu-label">关于我们</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goToFeedback">
          <text class="menu-icon">📝</text>
          <text class="menu-label">意见反馈</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <!-- Logout Button -->
      <button class="logout-btn" @click="handleLogout">
        <text class="logout-text">退出登录</text>
      </button>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const userInfo = ref({})
const myPoints = ref(1280)
const attendance = ref('96%')
const rank = ref('5')

const menuGroups = ref([
  {
    title: '我的服务',
    items: [
      { key: 'points', icon: '⭐', label: '积分中心', url: '/pages/points/index' },
      { key: 'leave', icon: '🏥', label: '请假记录', url: '/pages/leave/index' },
      { key: 'fee', icon: '💰', label: '班费记录', url: '/pages/fee/index' },
      { key: 'homework', icon: '📝', label: '作业记录', url: '/pages/homework/index' }
    ]
  },
  {
    title: '我的活动',
    items: [
      { key: 'challenge', icon: '🏆', label: '擂台挑战', url: '/pages/challenge/index' },
      { key: 'lottery', icon: '🎁', label: '抽奖活动', url: '/pages/lottery/index' },
      { key: 'vote', icon: '🗳️', label: '投票记录', url: '/pages/vote/index' }
    ]
  }
])

onMounted(() => {
  const stored = uni.getStorageSync('userInfo')
  if (stored) {
    try {
      userInfo.value = JSON.parse(stored)
    } catch (e) {}
  }
})

function goPage(item) {
  if (!item.url) return
  uni.navigateTo({ url: item.url })
}

function goToSettings() {
  uni.showToast({ title: '系统设置', icon: 'none' })
}

function goToAbout() {
  uni.showToast({ title: '关于我们', icon: 'none' })
}

function goToFeedback() {
  uni.navigateTo({ url: '/pages/suggestion/submit' })
}

function handleLogout() {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出当前账号吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('userInfo')
        uni.removeStorageSync('token')
        uni.reLaunch({ url: '/pages/auth/register' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
@import "../../uni.scss";

.profile-page {
  min-height: 100vh;
  background: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

/* Profile Header */
.profile-header {
  position: relative;
  margin-bottom: $spacing-lg;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0;
  left: -20%;
  right: -20%;
  height: 320rpx;
  background: $gradient-primary;
  border-radius: 0 0 50% 50%;
}

.user-info {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  padding: 48rpx $spacing-md 24rpx;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.25);
}

.username {
  font-family: $font-display;
  font-size: 34rpx;
  font-weight: $font-weight-bold;
  color: #ffffff;
  display: block;
}

.role-badge {
  margin-top: $spacing-xs;
  padding: 4rpx 20rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: $radius-full;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
  font-weight: $font-weight-medium;
}

.stats-row {
  position: relative;
  z-index: 1;
  display: flex;
  margin: 0 $spacing-md;
  background: $surface-container-lowest;
  border-radius: $radius-lg;
  box-shadow: $shadow-ambient;
  overflow: hidden;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: $spacing-md $spacing-sm;
}

.stat-val {
  display: block;
  font-family: $font-display;
  font-size: 34rpx;
  font-weight: $font-weight-bold;
  color: $primary;
  margin-bottom: $spacing-xs;
  line-height: 1;
}

.stat-label {
  font-size: $body-md;
  color: $on-surface-variant;
}

.stat-divider {
  width: 1rpx;
  background: $surface-container-low;
}

/* Menu Sections */
.menu-section {
  padding: 0 $spacing-md $spacing-md;
}

.menu-group {
  margin-bottom: $spacing-lg;
}

.group-title {
  font-family: $font-display;
  font-size: $title-md;
  font-weight: $font-weight-semibold;
  color: $on-surface-variant;
  letter-spacing: 2rpx;
  display: block;
  margin-bottom: $spacing-sm;
}

.menu-item {
  @include actionable-card;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-bottom: $spacing-sm;
  padding: $spacing-md;
}

.menu-icon {
  font-size: 36rpx;
  width: 48rpx;
  text-align: center;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  font-size: $body-md;
  font-weight: $font-weight-medium;
  color: $on-surface;
}

.menu-arrow {
  font-size: 36rpx;
  color: $on-surface-tertiary;
  flex-shrink: 0;
}

/* Settings Section */
.settings-section {
  padding: 0 $spacing-md $spacing-lg;
}

/* Logout Button */
.logout-btn {
  margin: 0 $spacing-md 0;
  height: 88rpx;
  background: transparent;
  border: 2rpx solid rgba(70, 0, 2, 0.15);
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all $transition-fast;
  
  &::after {
    display: none;
  }
  
  &:active {
    background: rgba(70, 0, 2, 0.04);
    border-color: rgba(70, 0, 2, 0.25);
  }
}

.logout-text {
  font-size: $body-md;
  font-weight: $font-weight-medium;
  color: $tertiary;
}
</style>