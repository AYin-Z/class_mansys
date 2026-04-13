<template>
  <view class="status-page">
    <custom-nav-bar title="建议详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="detail-card">
        <view :class="['status-badge', detail.status]">{{ sugStatus(detail.status) }}</view>
        <text class="detail-title">{{ detail.title }}</text>

        <view class="timeline-section">
          <text class="section-label">处理进度</text>
          <view v-for="(step, idx) in steps" :key="idx" class="step-item">
            <view :class="['step-dot', step.done ? 'done' : 'pending']"></view>
            <view class="step-line" v-if="idx < steps.length - 1" :class="{ done: step.done }"></view>
            <view class="step-content">
              <text :class="['step-name', { active: step.done }]">{{ step.name }}</text>
              <text class="step-time">{{ step.time || '待处理' }}</text>
              <text class="step-note" v-if="step.note">{{ step.note }}</text>
            </view>
          </view>
        </view>

        <view class="reply-section" v-if="detail.reply">
          <text class="section-label">回复内容</text>
          <view class="reply-box"><text class="reply-text">{{ detail.reply }}</text></view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const detail = ref({
  title: '希望增加自习室开放时间',
  status: 'processing',
  reply: '感谢您的建议！我们已向学校提交申请，预计下周会有答复。'
})
const steps = ref([
  { name: '提交成功', time: '2026-04-03 10:20', note: '', done: true },
  { name: '区队干部接收', time: '2026-04-03 14:00', note: '', done: true },
  { name: '处理中', time: '', note: '已提交学校相关部门', done: false }
])
function sugStatus(s) {
  if (s === 'processing') return '处理中'
  return '已回复'
}
</script>

<style lang="scss" scoped
> .status-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.detail-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.status-badge {
  display: inline-block; padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.processing { background: rgba(70,98,112,0.08); color: #466270; }
  &.replied { background: rgba(0,30,64,0.06); color: #001e40; }
}
.detail-title { font-family: 'PingFang SC'; font-size: 31rpx; font-weight: 700; color: #191c1e; display: block; margin-top: 16rpx; margin-bottom: 22rpx; }

.timeline-section { margin-top: 12rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 20rpx; }

.step-item { display: flex; gap: 16rpx; &:last-child .step-line { display: none; } }
.step-dot {
  width: 26rpx; height: 26rpx; border-radius: 50%; flex-shrink: 0; margin-top: 4rpx;
  &.done { background: linear-gradient(135deg, #001e40, #003366); }
  &.pending { background: #f2f4f7; border: 2rpx solid #e0e3e6; }
}
.step-line { width: 2rpx; flex: 1; margin-left: 12rpx; background: #e0e3e6; &.done { background: #001e40; } }
.step-content { flex: 1; padding-bottom: 24rpx; }
.step-name { font-size: 26rpx; color: #c3c6d1; &.active { color: #191c1e; font-weight: 500; } }
.step-time { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.step-note { font-size: 23rpx; color: #466270; margin-top: 4rpx; display: block; }

.reply-section { margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #f2f4f7; }
.reply-box { background: rgba(70,98,112,0.05); border-radius: 14rpx; padding: 20rpx; border-left: 5rpx solid #466270; }
.reply-text { font-size: 26rpx; color: #191c1e; line-height: 1.6; }
</style>