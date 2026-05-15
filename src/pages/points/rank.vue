<template>
  <view class="rank-page">
    <custom-nav-bar title="积分排行榜" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <!-- Top 3 -->
      <view class="top-three">
        <view v-for="(item, idx) in topThree" :key="item.id" :class="['top-card', 'pos-' + (idx + 1)]">
          <text class="rank-num">{{ idx + 1 }}</text>
          <image class="avatar" :src="getDefaultAvatar(item.name)" mode="aspectFill" />
          <text class="name">{{ item.name }}</text>
          <text class="pts">{{ item.points }}分</text>
        </view>
      </view>

      <!-- Full List -->
      <view class="full-list">
        <view v-for="(item, idx) in rankList" :key="item.id" class="rank-row">
          <text class="row-rank">{{ idx + 4 }}</text>
          <image class="row-avatar" :src="getDefaultAvatar(item.name)" mode="aspectFill" />
          <text class="row-name">{{ item.name }}</text>
          <text class="row-pts">{{ item.points }}</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getPointsRanking } from '@/api/points'
import { getDefaultAvatar } from '@/utils/avatar'

const allList = ref([])
const topThree = computed(() => allList.value.slice(0, 3).map(u => ({ id: u.id, name: u.name, points: u.total_score })))
const rankList = computed(() => allList.value.slice(3).map(u => ({ id: u.id, name: u.name, points: u.total_score })))

async function fetchRank() {
  try {
    const res = await getPointsRanking(200)
    allList.value = res?.ranking || []
  } catch (_) { allList.value = [] }
}

onShow(() => { fetchRank() })
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.rank-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.top-three {
  display: flex; justify-content: center; align-items: flex-end; gap: 16rpx;
  padding: 32rpx 24rpx; margin-bottom: 20rpx;
}
.top-card {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx;
  background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx;
  padding: 24rpx 16rpx;
  &.pos-1 { padding-top: 32rpx; z-index: 2; transform: translateY(-12rpx); }
  &.pos-2 { opacity: 0.92; z-index: 1; }
  &.pos-3 { opacity: 0.85; }
}
.rank-num {
  width: 44rpx; height: 44rpx; border-radius: 50%; background: rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center; font-size: 24rpx; font-weight: 700; color: #fff;
}
.avatar { width: 72rpx; height: 72rpx; border-radius: 50%; border: 3rpx solid rgba(255,255,255,0.25); }
.name { font-size: 24rpx; font-weight: 600; color: #fff; }
.pts { font-size: 26rpx; font-weight: 700; color: rgba(255,255,255,0.85); }

.full-list { padding: 0 32rpx; }
.rank-row {
  display: flex; align-items: center; gap: 14rpx; padding: 18rpx 24rpx;
  background: #fff; border-radius: 14rpx; margin-bottom: 10rpx;
}
.row-rank { width: 40rpx; text-align: center; font-size: 26rpx; font-weight: 600; color: #c3c6d1; }
.row-avatar { width: 52rpx; height: 52rpx; border-radius: 50%; }
.row-name { flex: 1; font-size: 27rpx; font-weight: 500; color: #191c1e; }
.row-pts { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 700; color: #001e40; }
</style>
