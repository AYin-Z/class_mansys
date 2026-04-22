<template>
  <view class="profile-page">
    <custom-nav-bar title="我的" />
    <scroll-view scroll-y class="main-scroll">
      <!-- Profile Header -->
      <view class="profile-header">
        <view class="header-bg"></view>
        <view class="user-info">
          <image class="avatar" :src="avatar" mode="aspectFill" />
          <text class="username">{{ displayName }}</text>
          <text class="role-badge">{{ roleLabel }}</text>
          <text v-if="profile?.student_id" class="sub-line">学号 {{ profile.student_id }}</text>
        </view>
        <view class="stats-row">
          <view class="stat-item">
            <text class="stat-val">{{ profile?.class_id || '—' }}</text>
            <text class="stat-label">班级</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-val">{{ profile?.phone ? maskPhone(profile.phone) : '—' }}</text>
            <text class="stat-label">手机</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-val">{{ isAdminUser ? '管理员' : '学员' }}</text>
            <text class="stat-label">身份</text>
          </view>
        </view>
      </view>

      <!-- Menu Sections -->
      <view class="menu-section">
        <view v-if="isAdminUser" class="menu-group">
          <text class="group-title">管理员后台</text>
          <view class="menu-item" @tap="goPage({ url: '/pages/admin/members/index' })">
            <text class="menu-icon">👥</text>
            <text class="menu-label">成员管理</text>
            <text class="menu-arrow">›</text>
          </view>
        </view>
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
        <!-- #ifdef APP-PLUS -->
        <view class="menu-item" @tap="handleCheckUpdate">
          <text class="menu-icon">🔄</text>
          <text class="menu-label">检查更新</text>
          <text class="menu-version">v{{ currentVersionName }}</text>
          <text class="menu-arrow">›</text>
        </view>
        <!-- #endif -->
      </view>

      <!-- Logout Button -->
      <button class="logout-btn" @click="handleLogout">
        <text class="logout-text">退出登录</text>
      </button>

      <view style="height: 40rpx;"></view>
    </scroll-view>

    <custom-tab-bar current="profile" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { logout as cloudbaseLogout } from '@/utils/cloudbase'
import { getDefaultAvatar } from '@/utils/avatar'
// #ifdef APP-PLUS
import { checkAppUpdate, getCurrentAppVersion } from '@/utils/update-checker'
// #endif

const userStore = useUserStore()
const { profile, isAdmin: isAdminUser, displayName, roleLabel } = storeToRefs(userStore)

const avatar = computed(() => profile.value?.avatarUrl || getDefaultAvatar(displayName.value))

function maskPhone(p) {
  if (!p) return ''
  const s = String(p)
  if (s.length < 7) return s
  return s.slice(0, 3) + '****' + s.slice(-4)
}

const menuGroups = ref([
  {
    title: '我的服务',
    items: [
      { key: 'leave', icon: '🏥', label: '请假记录', url: '/pages/leave/index' },
      { key: 'fee', icon: '💰', label: '班费记录', url: '/pages/fee/index' },
      { key: 'notice', icon: '📢', label: '通知中心', url: '/pages/notice/index' },
      { key: 'announcement', icon: '📰', label: '公告资源', url: '/pages/announcement/index' }
    ]
  },
  {
    title: '互动中心',
    items: [
      { key: 'album', icon: '📷', label: '区队相册', url: '/pages/album/index' },
      { key: 'vote', icon: '🗳️', label: '投票活动', url: '/pages/vote/index' },
      { key: 'suggestion', icon: '💡', label: '建议箱', url: '/pages/suggestion/index' }
    ]
  }
])

async function refresh() {
  // 优先用 store 内本地数据，再后台拉一次最新
  userStore.hydrate()
  try { await userStore.refresh() } catch (e) {}
}

function goPage(item) {
  if (!item.url) return
  uni.navigateTo({ url: item.url })
}

function goToSettings() {
  uni.showToast({ title: '系统设置开发中', icon: 'none' })
}

function goToAbout() {
  uni.showModal({
    title: '关于',
    content: '区队管理系统 v1.0\n基于 UniApp + Express + CloudBase',
    showCancel: false
  })
}

function goToFeedback() {
  uni.navigateTo({ url: '/pages/suggestion/submit' })
}

// #ifdef APP-PLUS
const currentVersionName = ref(getCurrentAppVersion()?.versionName || '1.0.0')

async function handleCheckUpdate() {
  uni.showLoading({ title: '检查中...', mask: true })
  try {
    await checkAppUpdate({ silent: false })
  } finally {
    uni.hideLoading()
  }
}
// #endif

async function handleLogout() {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出当前账号吗？',
    success: async (res) => {
      if (!res.confirm) return
      try { await cloudbaseLogout() } catch (e) {}
      userStore.logout()
      uni.reLaunch({ url: '/pages/auth/register' })
    }
  })
}

onShow(() => refresh())
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
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
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

.sub-line {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 1rpx;
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

.menu-version {
  font-size: 24rpx;
  color: $on-surface-tertiary;
  margin-right: 12rpx;
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