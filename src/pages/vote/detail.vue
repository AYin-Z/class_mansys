<template>
  <view class="detail-page">
    <custom-nav-bar title="投票详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="vote-info">
        <text class="vote-title">{{ vote.title }}</text>
        <text class="vote-desc">{{ vote.desc }}</text>
        <view :class="['status-badge', vote.status]">{{ statusText(vote.status) }}</view>
      </view>

      <view class="options-section">
        <text class="section-label">投票选项</text>
        <view v-for="(opt, idx) in options" :key="idx" class="option-card" @tap="selectOption(idx)">
          <view class="option-header">
            <view :class="['radio', { selected: selectedIdx === idx }]"></view>
            <text class="option-label">{{ opt.label }}</text>
            <text class="option-count" v-if="voted">{{ opt.count }}票</text>
          </view>
          <view v-if="voted" class="progress-bar-sm"><view class="progress-fill" :style="{ width: opt.rate + '%' }"></view></view>
        </view>
      </view>

      <button class="submit-btn" v-if="!voted && vote.status === 'active'" @click="castVote">提交投票</button>
      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const voted = ref(false)
const selectedIdx = ref(-1)
const vote = ref({ title: '春游地点选择', desc: '选择本学期春游目的地', type: 'single', status: 'active' })
const options = ref([
  { label: '西湖风景区', count: 12, rate: 40 },
  { label: '千岛湖', count: 8, rate: 27 },
  { label: '西溪湿地', count: 6, rate: 20 },
  { label: '灵隐寺', count: 4, rate: 13 }
])
function statusText(s) { return s === 'active' ? '进行中' : '已结束' }
function selectOption(idx) {
  if (!voted.value && vote.value.status === 'active') selectedIdx.value = idx
}
function castVote() {
  if (selectedIdx.value === -1) { uni.showToast({ title: '请选择选项', icon: 'none' }); return }
  voted.value = true; uni.showToast({ title: '投票成功', icon: 'success' })
}
</script>

<style lang="scss" scoped
> .detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.vote-info { margin: 24rpx 32rpx; padding: 28rpx 24rpx; background: #fff; border-radius: 20rpx; }
.vote-title { font-family: 'PingFang SC'; font-size: 34rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 12rpx; }
.vote-desc { font-size: 26rpx; color: #43474f; line-height: 1.5; display: block; margin-bottom: 16rpx; }
.status-badge {
  display: inline-block; padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.08); color: #466270; }
  &.ended { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}

.options-section { margin: 0 32rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 4rpx; display: block; margin-bottom: 18rpx; }

.option-card { background: #fff; border-radius: 16rpx; padding: 22rpx 24rpx; margin-bottom: 14rpx; &:active { opacity: 0.85; } }
.option-header { display: flex; align-items: center; gap: 14rpx; }
.radio {
  width: 36rpx; height: 36rpx; border-radius: 50%; border: 3rpx solid #e0e3e6;
  flex-shrink: 0; transition: all 0.2s;
  &.selected { border-color: #001e40; background: linear-gradient(135deg, #001e40, #003366); box-shadow: inset 0 0 0 5rpx #fff; }
}
.option-label { flex: 1; font-size: 28rpx; font-weight: 500; color: #191c1e; }
.option-count { font-size: 24rpx; color: #001e40; font-weight: 600; }
.progress-bar-sm { height: 8rpx; background: #f2f4f7; border-radius: 4rpx; overflow: hidden; margin-top: 14rpx; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 4rpx; }

.submit-btn { margin: 28rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; font-size: 29rpx; font-weight: 600; color: #fff; &::after { display: none; } }
</style>