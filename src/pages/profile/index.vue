<template>
  <div class="profile-page">
    <custom-nav-bar title="我的" />
    <div scroll-y class="main-scroll">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="header-bg"></div>
        <div class="user-info">
          <img class="avatar" :src="avatar" mode="aspectFill" />
          <span class="username">{{ displayName }}</span>
          <span class="role-badge">{{ roleLabel }}</span>
          <span v-if="profile?.student_id" class="sub-line">学号 {{ profile.student_id }}</span>
        </div>
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-val">{{ profile?.class_id || '—' }}</span>
            <span class="stat-label">班级</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-val">{{ profile?.phone ? maskPhone(profile.phone) : '—' }}</span>
            <span class="stat-label">手机</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-val">{{ isAdminUser ? '管理员' : '学员' }}</span>
            <span class="stat-label">身份</span>
          </div>
        </div>
      </div>

      <!-- Menu Sections -->
      <div class="menu-section">
        <div v-if="isAdminUser" class="menu-group">
          <span class="group-title">管理员后台</span>
          <div class="menu-item" @tap="goPage({ url: '/pages/admin/members/index' })">
            <span class="menu-icon">👥</span>
            <span class="menu-label">成员管理</span>
            <span class="menu-arrow">›</span>
          </div>
        </div>
        <div v-for="group in menuGroups" :key="group.title" class="menu-group">
          <span class="group-title">{{ group.title }}</span>
          <div v-for="item in group.items" :key="item.key" class="menu-item" @tap="goPage(item)">
            <span class="menu-icon">{{ item.icon }}</span>
            <span class="menu-label">{{ item.label }}</span>
            <span class="menu-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- Settings Section -->
      <div class="settings-section">
        <span class="group-title">设置</span>
        <div class="menu-item" @tap="goToSettings">
          <span class="menu-icon">⚙️</span>
          <span class="menu-label">系统设置</span>
          <span class="menu-arrow">›</span>
        </div>
        <div class="menu-item" @tap="goToAbout">
          <span class="menu-icon">ℹ️</span>
          <span class="menu-label">关于我们</span>
          <span class="menu-arrow">›</span>
        </div>
        <div class="menu-item" @tap="goToFeedback">
          <span class="menu-icon">📝</span>
          <span class="menu-label">意见反馈</span>
          <span class="menu-arrow">›</span>
        </div>
        <div class="menu-item" @tap="handleCheckUpdate">
          <span class="menu-icon">🔄</span>
          <span class="menu-label">检查更新</span>
          <span class="menu-version">v{{ currentVersionName }}</span>
          <span class="menu-arrow">›</span>
        </div>
      </div>

      <!-- Logout Button -->
      <button class="logout-btn" @click="handleLogout">
        <span class="logout-text">退出登录</span>
      </button>

      <div style="height: 40rpx;"></div>
    </div>

    <custom-tab-bar current="profile" />
  </div>
</template>

<script setup lang="ts">

import { computed, onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { getDefaultAvatar } from '@/utils/avatar'
import { checkAppUpdate, getCurrentAppVersion } from '@/utils/update-checker'
import { showConfirm, showToast } from '@/utils/ui'
const router = useRouter()
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
      { key: 'announcement', icon: '📰', label: '公告资源', url: '/pages/announcement/index' },
      { key: 'homework', icon: '📚', label: '作业管理', url: '/pages/homework/index' },
      { key: 'psychological', icon: '🧠', label: '心理干预', url: '/pages/psychological/index' }
    ]
  },
  {
    title: '互动中心',
    items: [
      { key: 'album', icon: '📷', label: '区队相册', url: '/pages/album/index' },
      { key: 'vote', icon: '🗳️', label: '投票活动', url: '/pages/vote/index' },
      { key: 'suggestion', icon: '💡', label: '建议箱', url: '/pages/suggestion/index' },
      { key: 'challenge', icon: '⚔️', label: '擂台挑战', url: '/pages/challenge/index' },
      { key: 'lottery', icon: '🎲', label: '抽奖活动', url: '/pages/lottery/index' },
      { key: 'points', icon: '⭐', label: '积分中心', url: '/pages/points/index' }
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
  router.push(item.url)
}

function goToSettings() {
  router.push('/pages/profile/settings')
}

function goToAbout() {
  showConfirm('', '区队管理系统 v1.0\n基于 UniApp + Express')
}

function goToFeedback() {
  router.push('/pages/suggestion/submit')
}

const currentVersionName = ref(getCurrentAppVersion()?.versionName || '1.0.0')

async function handleCheckUpdate() {
  showToast('检查中...')
  try {
    await checkAppUpdate({ silent: false })
  } finally {
    
  }
}

async function handleLogout() {
  const confirmed = await showConfirm('确认退出', '确定要退出当前账号吗？')
  if (!confirmed) return
  userStore.logout()
  router.replace('/pages/login/password-login')
}

onActivated(() => refresh())

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

.profile-header {
  position: relative;
  padding: $spacing-lg;
  margin-bottom: $spacing-lg;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 240rpx;
  background: linear-gradient(135deg, $primary, $primary-container);
  border-radius: 0 0 40rpx 40rpx;
}

.user-info {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  border: 4rpx solid white;
  object-fit: cover;
}

.username {
  font-family: $font-display;
  font-size: $title-md;
  font-weight: $font-weight-semibold;
  color: $on-primary;
  letter-spacing: 2rpx;
}

.role-badge {
  display: inline-block;
  padding: 4rpx 20rpx;
  background: rgba(255,255,255,0.2);
  border-radius: 20rpx;
  font-size: 24rpx;
  color: $on-primary;
}

.sub-line {
  font-size: $body-sm;
  color: rgba(255,255,255,0.7);
}

.stats-row {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-around;
  background: $surface;
  border-radius: $radius-lg;
  padding: $spacing-md 0;
  margin-top: $spacing-md;
  box-shadow: $shadow-ambient;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.stat-divider {
  width: 1px;
  background: $outline-variant;
}

.stat-val {
  font-size: $body-md;
  font-weight: $font-weight-semibold;
  color: $on-surface;
}

.stat-label {
  font-size: 22rpx;
  color: $on-surface-tertiary;
}

/* Menu Sections */
.menu-section {
  padding: 0 $spacing-md;
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

