<template>
  <view class="status-page">
    <custom-nav-bar title="处理状态" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="timeline-card">
        <view v-for="(step, idx) in steps" :key="idx" class="timeline-item">
          <view class="step-dot-wrap">
            <view :class="['step-dot', step.done ? 'done' : 'pending']">{{ idx + 1 }}</view>
            <view class="step-line" v-if="idx < steps.length - 1"></view>
          </view>
          <view class="step-content">
            <text :class="['step-title', { active: step.done }]">{{ step.title }}</text>
            <text class="step-time">{{ step.time || '待处理' }}</text>
            <text class="step-note" v-if="step.note">{{ step.note }}</text>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const steps = ref([
  { title: '提交申请', time: '2026-04-05 14:30', note: '', done: true },
  { title: '心理副区接收', time: '2026-04-05 16:00', note: '已安排面谈时间', done: true },
  { title: '面谈处理中', time: '', note: '预约时间：4月7日 15:00', done: false }
])
</script>

<style lang="scss" scoped
> .status-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.timeline-card {
  margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 32rpx 24rpx;
}
.timeline-item { display: flex; gap: 20rpx; &:last-child .step-line { display: none; } }

.step-dot-wrap { display: flex; flex-direction: column; align-items: center; width: 36rpx; flex-shrink: 0; }
.step-dot {
  width: 36rpx; height: 36rpx; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 20rpx; font-weight: 700;
  &.done { background: linear-gradient(135deg, #001e40, #003366); color: #fff; }
  &.pending { background: #f2f4f7; color: #c3c6d1; }
}
.step-line { flex: 1; width: 2rpx; background: #e6e8eb; margin-top: 8rpx; }

.step-content { flex: 1; padding-bottom: 32rpx; }
.step-title { font-size: 27rpx; font-weight: 500; color: #c3c6d1; &.active { color: #191c1e; } }
.step-time { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.step-note { font-size: 23rpx; color: #466270; margin-top: 6rpx; display: block; }
</style>