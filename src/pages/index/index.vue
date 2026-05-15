<template>
  <view class="home-page">
    <custom-nav-bar title="区队管理系统" />
    <scroll-view scroll-y class="main-scroll" enable-back-to-top>
      <home-hero
        :avatar="avatar"
        :display-name="displayName"
        :role-label="roleLabel"
        :class-id="profile?.class_id"
        :student-id="profile?.student_id"
        :current-date="currentDate"
        :greeting="greeting"
      />

      <home-pinned-notices
        :notices="pinnedNotices"
        @view="goToNoticeDetail"
      />

      <home-quick-actions
        :actions="actions"
        @navigate="goToPage"
      />

      <home-status-cards
        :status-data="statusData"
        @tap="onStatusTap"
      />

      <home-recent-updates
        :updates="recentUpdates"
        @view="goToNoticeDetail"
      />

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
import { canPublishNotice } from '@/utils/auth'
import { getBalance } from '@/api/fee'
import { getNotices, getUnreadCount } from '@/api/notice'
import { getMyLeaves } from '@/api/leave'
import { hasBackendToken } from '@/utils/request'
import { getDefaultAvatar } from '@/utils/avatar'

import HomeHero from '@/components/home-hero.vue'
import HomePinnedNotices from '@/components/home-pinned-notices.vue'
import HomeQuickActions from '@/components/home-quick-actions.vue'
import HomeStatusCards from '@/components/home-status-cards.vue'
import HomeRecentUpdates from '@/components/home-recent-updates.vue'

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
@import "@/uni.scss";

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
