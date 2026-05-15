<template>
  <view class="points-page">
    <custom-nav-bar title="积分中心" />
    <scroll-view scroll-y class="main-scroll">
      <!-- Points Overview -->
      <view class="overview-card">
        <text class="overview-label">我的积分</text>
        <text class="points-value">{{ myPoints }}</text>
        <view class="rank-badge">全区队第 {{ myRank }} 名</view>
      </view>

      <!-- Quick Actions -->
      <view class="actions-grid">
        <view v-for="act in actions" :key="act.key" class="action-item" @tap="goAction(act)">
          <text class="action-icon">{{ act.icon }}</text>
          <text class="action-label">{{ act.label }}</text>
        </view>
      </view>

      <!-- Recent Records -->
      <view class="records-section">
        <text class="section-label">积分记录</text>
        <view v-for="item in records" :key="item.id" class="record-card">
          <view :class="['record-dot', item.type]"></view>
          <view class="record-body">
            <text class="record-title">{{ item.title }}</text>
            <text class="record-time">{{ item.time }}</text>
            <text :class="['record-points', item.type]">{{ item.type === 'add' ? '+' : '' }}{{ item.points }}</text>
          </view>
        </view>

        <view v-if="records.length === 0" class="empty-state"><text class="empty-text">暂无记录</text></view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getMyPoints, getPointsRanking } from '@/api/points'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const myPoints = ref(0)
const myRank = ref('-')
const records = ref([])

const actions = computed(() => {
  const base = [
    { key: 'rank', icon: '🏆', label: '排行榜' },
    { key: 'rate', icon: '📊', label: '互评' },
    { key: 'rules', icon: '📋', label: '积分规则' }
  ]
  if (isAdminUser.value) base.push({ key: 'admin', icon: '⚙️', label: '加扣分' })
  return base
})

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchAll() {
  try {
    const [mineRes, rankRes] = await Promise.all([
      getMyPoints(),
      getPointsRanking(200)
    ])
    myPoints.value = mineRes?.total ?? 0
    records.value = (mineRes?.records || []).map(r => ({
      id: r.id,
      title: r.reason,
      time: formatDate(r.created_at),
      points: r.score,
      type: r.score >= 0 ? 'add' : 'minus'
    }))
    const ranking = rankRes?.ranking || []
    const myUserId = profile.value?.id
    const myIdx = ranking.findIndex(u => u.id === myUserId)
    myRank.value = myIdx >= 0 ? `${myIdx + 1}` : '-'
  } catch (_) {}
}

function goAction(act) {
  if (act.key === 'rank') uni.navigateTo({ url: '/pages/points/rank' })
  else if (act.key === 'rate') uni.navigateTo({ url: '/pages/points/rate' })
  else if (act.key === 'rules') uni.showModal({ title: '积分规则', content: '正向行为加分、违规扣分；具体明细以管理员公示为准', showCancel: false })
  else if (act.key === 'admin') uni.navigateTo({ url: '/pages/points/rate?admin=1' })
}

onShow(() => { fetchAll() })
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.points-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.overview-card {
  margin: 24rpx 32rpx; background: linear-gradient(135deg, #001e40, #003366);
  border-radius: 22rpx; padding: 36rpx 28rpx;
}
.overview-label { font-size: 25rpx; color: rgba(255,255,255,0.65); display: block; margin-bottom: 8rpx; }
.points-value {
  font-family: 'PingFang SC'; font-size: 64rpx; font-weight: 800; color: #fff; display: block; line-height: 1.2;
}
.rank-badge {
  display: inline-block; margin-top: 14rpx; padding: 8rpx 22rpx; background: rgba(255,255,255,0.15);
  border-radius: 999rpx; font-size: 24rpx; font-weight: 600; color: #fff;
}

.actions-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; padding: 24rpx 32rpx;
}
.action-item {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx;
  padding: 24rpx 12rpx; background: #fff; border-radius: 18rpx; &:active { opacity: 0.85; }
}
.action-icon { font-size: 36rpx; }
.action-label { font-size: 23rpx; color: #43474f; }

.records-section { padding: 24rpx 32rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 4rpx; display: block; margin-bottom: 18rpx; }

.record-card { position: relative; display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 12rpx; }
.record-dot {
  width: 10rpx; flex-shrink: 0;
  &.add { background: #003366; }
  &.minus { background: #460002; }
}
.record-body { flex: 1; padding: 20rpx 24rpx; display: flex; align-items: center; gap: 12rpx; }
.record-title { flex: 1; font-size: 26rpx; font-weight: 500; color: #191c1e; }
.record-time { font-size: 22rpx; color: #c3c6d1; white-space: nowrap; }
.record-points { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 700; white-space: nowrap;
  &.add { color: #001e40; }
  &.minus { color: #460002; }
}

.empty-state { padding: 60rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
