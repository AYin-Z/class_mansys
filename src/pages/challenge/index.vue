<template>
  <view class="challenge-page">
    <custom-nav-bar title="擂台挑战" />
    <scroll-view scroll-y class="main-scroll">
      <view class="category-tabs">
        <view v-for="cat in categories" :key="cat.key" :class="['cat-tab', { active: currentCat === cat.key }]" @tap="currentCat = cat.key">
          <text class="cat-icon">{{ cat.icon }}</text>
          <text class="cat-label">{{ cat.label }}</text>
        </view>
      </view>

      <view class="challenge-list">
        <view v-for="item in filteredChallenges" :key="item.id" class="challenge-card" @tap="goDetail(item)">
          <view class="card-header">
            <view :class="['type-badge', typeKey(item.type)]">{{ item.type }}</view>
            <view class="status-badge active" v-if="item.champion_name">擂主：{{ item.champion_name }}</view>
            <view class="status-badge ended" v-else>虚位以待</view>
          </view>
          <text class="ch-title">{{ item.name }}</text>
          <view class="ch-meta">
            <text class="meta-item" v-if="item.record_count !== undefined">挑战记录：{{ item.record_count }} 次</text>
          </view>
          <text class="ch-desc">{{ item.description }}</text>
        </view>

        <view v-if="!loading && filteredChallenges.length === 0" class="empty-state"><text class="empty-text">暂无擂台</text></view>
      </view>

      <button v-if="canCreate" class="create-btn" @tap="goCreate"><text class="create-text">+ 创建擂台</text></button>

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
import { getChallenges } from '@/api/challenge'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const canCreate = computed(() => checkIsAdmin(profile.value?.role))

const currentCat = ref('all')
const categories = [
  { key: 'all', icon: '🌐', label: '全部' },
  { key: '学习', icon: '📚', label: '学习' },
  { key: '纪律作风', icon: '📋', label: '纪律' },
  { key: '体能', icon: '💪', label: '体能' }
]

const challenges = ref([])
const loading = ref(false)

const filteredChallenges = computed(() => {
  if (currentCat.value === 'all') return challenges.value
  return challenges.value.filter(c => c.type === currentCat.value)
})

function typeKey(t) {
  if (t === '学习') return 'study'
  if (t === '体能') return 'fitness'
  return 'discipline'
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getChallenges()
    challenges.value = res?.challenges || []
  } catch (_) {
    challenges.value = []
  } finally { loading.value = false }
}

function goDetail(item) { uni.navigateTo({ url: `/pages/challenge/detail?id=${item.id}` }) }
function goCreate() { uni.navigateTo({ url: '/pages/challenge/create' }) }

onShow(() => fetchList())
</script>

<style lang="scss" scoped
> .challenge-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.category-tabs {
  display: flex; gap: 16rpx; padding: 20rpx 32rpx;
}
.cat-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  padding: 20rpx 12rpx; background: #fff; border-radius: 18rpx;
  &.active { background: linear-gradient(135deg, #001e40, #003366); .cat-icon, .cat-label { color: #fff; filter: grayscale(0); } }
}
.cat-icon { font-size: 36rpx; }
.cat-label { font-size: 24rpx; font-weight: 500; color: #43474f; }

.challenge-list { padding: 24rpx 32rpx; }

.challenge-card {
  background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; margin-bottom: 16rpx;
  &:active { opacity: 0.85; }
}
.card-header { display: flex; gap: 10rpx; margin-bottom: 14rpx; }
.type-badge {
  padding: 4rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.study { background: rgba(0,30,64,0.06); color: #001e40; }
  &.discipline { background: rgba(70,98,112,0.08); color: #466270; }
  &.fitness { background: rgba(70,0,2,0.05); color: #460002; }
}
.status-badge {
  padding: 4rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.1); color: #466270; }
  &.ended { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}

.ch-title { font-family: 'PingFang SC'; font-size: 29rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 12rpx; }
.ch-meta { display: flex; gap: 20rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.meta-item { font-size: 22rpx; color: #c3c6d1; }
.ch-desc { font-size: 24rpx; color: #43474f; line-height: 1.5; display: block; }

.progress-row { display: flex; align-items: center; gap: 12rpx; }
.progress-bar-sm { flex: 1; height: 10rpx; background: #f2f4f7; border-radius: 5rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 5rpx; }
.progress-text { font-size: 22rpx; color: #001e40; font-weight: 600; white-space: nowrap; }

.create-btn {
  margin: 24rpx 32rpx; height: 88rpx; background: #f2f4f7; border-radius: 18rpx; border: none;
  display: flex; align-items: center; justify-content: center; &::after { display: none; }
  &:active { background: #eceef1; }
}
.create-text { font-size: 28rpx; font-weight: 600; color: #001e40; }

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>