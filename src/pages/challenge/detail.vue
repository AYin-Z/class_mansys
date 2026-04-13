<template>
  <view class="detail-page">
    <custom-nav-bar title="挑战详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="info-card">
        <view :class="['type-badge', detail.type]">{{ typeName(detail.type) }}</view>
        <text class="detail-title">{{ detail.title }}</text>
        <text class="detail-desc">{{ detail.desc }}</text>
        <view class="info-row">
          <text class="info-label">发起人</text><text class="info-value">{{ detail.challenger }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">截止时间</text><text class="info-value">{{ detail.deadline }}</text>
        </view>
        <view class="progress-section">
          <view class="progress-header"><text class="progress-label">参与进度</text><text class="progress-num">{{ detail.votes }}人参与</text></view>
          <view class="progress-bar"><view class="progress-fill" :style="{ width: (detail.votes / 32 * 100) + '%' }"></view></view>
        </view>
      </view>

      <button class="join-btn" v-if="!joined" @click="joinChallenge">参加挑战</button>
      <view class="joined-tag" v-else>✓ 已参与</view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const joined = ref(false)
const detail = ref({ type: 'study', title: '高数月考挑战赛', desc: '月考成绩达到85分以上即为挑战成功', challenger: '学习副区', deadline: '2026-04-20 23:59', votes: 12 })
function typeName(t) { const map = { study: '学习', discipline: '纪律', fitness: '体能' }; return map[t] || t }
function joinChallenge() { joined.value = true; uni.showToast({ title: '已参加挑战', icon: 'success' }) }
</script>

<style lang="scss" scoped
> .detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.info-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 32rpx 28rpx; }
.type-badge {
  display: inline-block; padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.study { background: rgba(0,30,64,0.06); color: #001e40; }
  &.discipline { background: rgba(70,98,112,0.08); color: #466270; }
  &.fitness { background: rgba(70,0,2,0.05); color: #460002; }
}
.detail-title { font-family: 'PingFang SC'; font-size: 34rpx; font-weight: 700; color: #191c1e; display: block; margin-top: 16rpx; margin-bottom: 12rpx; }
.detail-desc { font-size: 26rpx; color: #43474f; line-height: 1.5; display: block; margin-bottom: 20rpx; }

.info-row { display: flex; justify-content: space-between; padding: 14rpx 0; border-bottom: 1rpx solid transparent; &:not(:last-child) { border-bottom-color: #f2f4f7; } }
.info-label { font-size: 25rpx; color: #c3c6d1; }
.info-value { font-size: 25rpx; color: #191c1e; font-weight: 500; }

.progress-section { margin-top: 24rpx; }
.progress-header { display: flex; justify-content: space-between; margin-bottom: 10rpx; }
.progress-label { font-size: 24rpx; color: #43474f; }
.progress-num { font-size: 24rpx; color: #001e40; font-weight: 600; }
.progress-bar { height: 12rpx; background: #f2f4f7; border-radius: 6rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 6rpx; transition: width 0.3s; }

.join-btn { margin: 28rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; font-size: 29rpx; font-weight: 600; color: #fff; &::after { display: none; } }
.joined-tag { margin: 28rpx 32rpx; text-align: center; padding: 24rpx; background: rgba(0,30,64,0.04); border-radius: 18rpx; font-size: 27rpx; font-weight: 600; color: #003366; }
</style>