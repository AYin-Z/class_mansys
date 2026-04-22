<template>
  <view class="home-page">
    <custom-nav-bar title="区队管理系统" />
    <scroll-view scroll-y class="main-scroll" enable-back-to-top>
      <!-- Hero Card -->
      <view class="hero-section">
        <view class="hero-card">
          <view class="hero-top">
            <image class="hero-avatar" :src="avatar" mode="aspectFill" />
            <view class="hero-meta">
              <text class="hero-greeting">{{ greeting }}</text>
              <text class="hero-name">{{ displayName }}</text>
              <view class="hero-tags">
                <text class="hero-tag primary">{{ roleLabel }}</text>
                <text v-if="profile?.class_id" class="hero-tag">{{ profile.class_id }}</text>
              </view>
            </view>
          </view>
          <view class="hero-bottom">
            <text class="hero-date">{{ currentDate }}</text>
            <text v-if="profile?.student_id" class="hero-sid">学号 {{ profile.student_id }}</text>
          </view>
        </view>
      </view>

      <!-- Pinned Notices -->
      <view v-if="pinnedNotices.length" class="pinned-section">
        <view class="pinned-header">
          <text class="pinned-tag">置顶</text>
          <text class="pinned-title-main">重要通知</text>
        </view>
        <view
          v-for="n in pinnedNotices"
          :key="n.id"
          class="pinned-card"
          :class="priorityClass(n.priority)"
          @tap="goToNoticeDetail(n)"
        >
          <view class="pinned-line">
            <text class="pinned-prio">{{ priorityLabel(n.priority) }}</text>
            <text class="pinned-time">{{ formatDate(n.created_at) }}</text>
          </view>
          <text class="pinned-title">{{ n.title }}</text>
        </view>
      </view>

      <!-- Quick Actions -->
      <view class="quick-actions">
        <view class="section-header">
          <text class="section-title">快捷功能</text>
          <text class="section-sub">常用模块</text>
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
          <text class="section-title">本人状态</text>
          <text class="section-sub">实时数据</text>
        </view>
        <view class="status-grid">
          <view v-for="stat in statusData" :key="stat.key" class="status-card" @tap="onStatusTap(stat)">
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
        <view v-if="recentUpdates.length === 0" class="empty-card">
          <text class="empty-text">暂无通知</text>
        </view>
        <view
          v-for="update in recentUpdates"
          :key="update.id"
          class="update-card"
          @tap="goToNoticeDetail(update)"
        >
          <view class="update-icon" :class="priorityClass(update.priority)">
            <text class="update-icon-text">{{ priorityIcon(update.priority) }}</text>
          </view>
          <view class="update-content">
            <text class="update-title">{{ update.title }}</text>
            <text class="update-time">{{ formatDate(update.created_at) }} · {{ update.creator_nickname || update.creator_name || '系统' }}</text>
          </view>
          <text class="update-arrow">›</text>
        </view>
      </view>

      <view style="height: 60rpx;"></view>
    </scroll-view>

    <!-- Floating Publish Button (admins) -->
    <view v-if="canPublishNotice()" class="fab" @tap="goToPublish">
      <text class="fab-icon">+</text>
    </view>

    <custom-tab-bar current="home" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { canPublishNotice } from '@/utils/auth.js'
import { getBalance } from '@/api/fee'
import { getNotices, getUnreadCount } from '@/api/notice'
import { getMyLeaves } from '@/api/leave'
import { hasBackendToken } from '@/utils/request'
import { getDefaultAvatar } from '@/utils/avatar'

const userStore = useUserStore()
const { profile, displayName, roleLabel } = storeToRefs(userStore)

const avatar = computed(() => profile.value?.avatarUrl || getDefaultAvatar(displayName.value))

const currentDate = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return `${y}年${m}月${d}日 · ${w}`
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，注意休息'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const actions = [
  { key: 'leave',        icon: '🏥', label: '请假销假',   url: '/pages/leave/index' },
  { key: 'fee',          icon: '💰', label: '班费管理',   url: '/pages/fee/index' },
  { key: 'notice',       icon: '📢', label: '通知中心',   url: '/pages/notice/index' },
  { key: 'announcement', icon: '📰', label: '公告资源',   url: '/pages/announcement/index' },
  { key: 'album',        icon: '📷', label: '区队相册',   url: '/pages/album/index' },
  { key: 'vote',         icon: '🗳️', label: '投票表决',   url: '/pages/vote/index' },
  { key: 'suggestion',   icon: '💡', label: '匿名建议',   url: '/pages/suggestion/index' },
  { key: 'homework',     icon: '📝', label: '作业管理',   url: '/pages/homework/index' }
]

const statusData = ref([
  { key: 'leave',  value: '0', label: '我的请假',  url: '/pages/leave/index' },
  { key: 'notice', value: '0', label: '未读通知',  url: '/pages/notice/index' },
  { key: 'fee',    value: '¥—', label: '班费余额', url: '/pages/fee/index' },
  { key: 'role',   value: '—', label: '我的身份',  url: '/pages/profile/index' }
])

const pinnedNotices = ref([])
const recentUpdates = ref([])

function priorityClass(p) {
  if (p >= 2) return 'urgent'
  if (p === 1) return 'important'
  return 'normal'
}
function priorityLabel(p) {
  if (p >= 2) return '紧急'
  if (p === 1) return '重要'
  return '日常'
}
function priorityIcon(p) {
  if (p >= 2) return '⚠'
  if (p === 1) return '★'
  return '•'
}
function formatDate(s) {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return s
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${hh}:${mm}`
}

async function refreshAll() {
  // 优先取本地，再后台拉
  userStore.hydrate()
  setStatus('role', roleLabel.value || '学员')

  if (!hasBackendToken()) return
  try { await userStore.refresh() } catch (_) {}
  setStatus('role', roleLabel.value || '学员')

  // 并发拉取，每个独立 try/catch 避免一个失败影响全部
  await Promise.all([loadNotices(), loadLeaves(), loadFeeBalance()])
}

function setStatus(key, value) {
  const item = statusData.value.find(x => x.key === key)
  if (item) item.value = value
}

async function loadNotices() {
  try {
    const res = await getNotices()
    if (res?.success && Array.isArray(res.notices)) {
      const all = res.notices
      pinnedNotices.value = all.filter(n => n.is_pinned).slice(0, 2)
      recentUpdates.value = all.filter(n => !n.is_pinned).slice(0, 5)
    }
  } catch (e) {
    console.warn('[home] notices 加载失败', e)
  }
  try {
    const r = await getUnreadCount()
    if (r?.success) setStatus('notice', String(r.count ?? 0))
  } catch (e) {
    // 后端没装该接口时静默
  }
}

async function loadLeaves() {
  try {
    const res = await getMyLeaves()
    if (res?.success && Array.isArray(res.leaves)) {
      const active = res.leaves.filter(l =>
        l.status === 1 && !(l.is_cancelled === 1 || l.is_cancelled === true)
      ).length
      setStatus('leave', String(active))
    }
  } catch (e) {
    console.warn('[home] leaves 加载失败', e)
  }
}

async function loadFeeBalance() {
  try {
    const res = await getBalance()
    if (res?.success && res.balance) {
      const v = res.balance.balance ?? 0
      setStatus('fee', `¥${Number(v).toLocaleString()}`)
    }
  } catch (e) {
    console.warn('[home] balance 加载失败', e)
  }
}

function onStatusTap(stat) {
  if (stat.url) uni.navigateTo({ url: stat.url })
}

function goToPage(action) {
  if (action.url) uni.navigateTo({ url: action.url })
}

function goToNoticeDetail(item) {
  uni.navigateTo({ url: `/pages/notice/detail?id=${item.id}` })
}

function goToPublish() {
  uni.navigateTo({ url: '/pages/notice/publish' })
}

onShow(() => { refreshAll() })
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
  /* 140rpx = custom-tab-bar 高 110rpx + 上下 buffer */
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

/* ============ Hero ============ */
.hero-section { padding: 24rpx 32rpx 8rpx; }

.hero-card {
  position: relative;
  padding: 36rpx 32rpx 28rpx;
  border-radius: 28rpx;
  background: $gradient-primary;
  color: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(0, 30, 64, 0.28);
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    right: -60rpx;
    top: -80rpx;
    width: 280rpx;
    height: 280rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 50%;
    pointer-events: none;
  }
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.hero-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.hero-meta {
  flex: 1;
  min-width: 0;
}

.hero-greeting {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 6rpx;
  letter-spacing: 1rpx;
}

.hero-name {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 1rpx;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.hero-tag {
  display: inline-block;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.92);

  &.primary {
    background: rgba(255, 255, 255, 0.92);
    color: $primary;
    font-weight: 600;
  }
}

.hero-bottom {
  margin-top: 28rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-date {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.hero-sid {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 1rpx;
}

/* ============ Pinned ============ */
.pinned-section { padding: 24rpx 32rpx 0; }

.pinned-header {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 16rpx;
}

.pinned-tag {
  padding: 4rpx 14rpx;
  background: rgba(70, 0, 2, 0.10);
  color: #460002;
  border-radius: 8rpx;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.pinned-title-main {
  font-size: 28rpx;
  font-weight: 700;
  color: $on-surface;
}

.pinned-card {
  position: relative;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx 28rpx 22rpx 36rpx;
  margin-bottom: 14rpx;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0; top: 16rpx; bottom: 16rpx;
    width: 8rpx;
    border-radius: 4rpx;
  }

  &.urgent::before    { background: #460002; }
  &.important::before { background: #b8860b; }
  &.normal::before    { background: $primary; }
}

.pinned-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.pinned-prio {
  font-size: 22rpx;
  font-weight: 600;
  color: $on-surface-variant;
  letter-spacing: 1rpx;
}

.pinned-time {
  font-size: 22rpx;
  color: $on-surface-tertiary;
}

.pinned-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $on-surface;
  line-height: 1.4;
}

/* ============ Section header ============ */
.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $on-surface;
  letter-spacing: 1rpx;
}

.section-sub {
  font-size: 22rpx;
  color: $on-surface-tertiary;
}

/* ============ Quick actions ============ */
.quick-actions {
  padding: 32rpx 32rpx 8rpx;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.action-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;

  &:active { background: #f2f4f7; }
}

.action-icon { font-size: 44rpx; line-height: 1; }
.action-label {
  font-size: 22rpx;
  font-weight: 500;
  color: $on-surface;
}

/* ============ Status ============ */
.system-status { padding: 28rpx 32rpx 8rpx; }

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.status-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  text-align: center;

  &:active { background: #f2f4f7; }
}

.stat-value {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: $primary;
  line-height: 1;
  margin-bottom: 10rpx;
  letter-spacing: 1rpx;
}

.stat-label {
  font-size: 22rpx;
  color: $on-surface-variant;
}

/* ============ Recent updates ============ */
.recent-updates { padding: 28rpx 32rpx 0; }

.empty-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 60rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 24rpx;
  color: $on-surface-tertiary;
}

.update-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 14rpx;

  &:active { background: #f2f4f7; }
}

.update-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.urgent    { background: rgba(70, 0, 2, 0.08); color: #460002; }
  &.important { background: rgba(184, 134, 11, 0.10); color: #8b6914; }
  &.normal    { background: rgba(0, 30, 64, 0.06); color: $primary; }
}

.update-icon-text { font-size: 32rpx; font-weight: 700; }

.update-content { flex: 1; min-width: 0; }

.update-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $on-surface;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-time {
  font-size: 22rpx;
  color: $on-surface-tertiary;
}

.update-arrow {
  font-size: 36rpx;
  color: $on-surface-tertiary;
  flex-shrink: 0;
}

/* ============ FAB ============ */
.fab {
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
  box-shadow: 0 12rpx 28rpx rgba(0, 30, 64, 0.35);
  z-index: 100;

  &:active { transform: scale(0.96); }
}

.fab-icon {
  font-size: 52rpx;
  color: #ffffff;
  line-height: 1;
  font-weight: 300;
}
</style>
