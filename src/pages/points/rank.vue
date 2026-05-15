<template>
  <div class="rank-page">
    <custom-nav-bar title="积分排行榜" :showBack="true" />
    <div scroll-y class="main-scroll">
      <!-- Top 3 -->
      <div class="top-three">
        <div v-for="(item, idx) in topThree" :key="item.id" :class="['top-card', 'pos-' + (idx + 1)]">
          <span class="rank-num">{{ idx + 1 }}</span>
          <img class="avatar" :src="getDefaultAvatar(item.name)" mode="aspectFill" />
          <span class="name">{{ item.name }}</span>
          <span class="pts">{{ item.points }}分</span>
        </div>
      </div>

      <!-- Full List -->
      <div class="full-list">
        <div v-for="(item, idx) in rankList" :key="item.id" class="rank-row">
          <span class="row-rank">{{ idx + 4 }}</span>
          <img class="row-avatar" :src="getDefaultAvatar(item.name)" mode="aspectFill" />
          <span class="row-name">{{ item.name }}</span>
          <span class="row-pts">{{ item.points }}</span>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onActivated, onMounted, ref } from 'vue'
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
