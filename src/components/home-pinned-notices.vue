<template>
  <view v-if="notices.length" class="pinned-section">
    <view class="pinned-header">
      <text class="pinned-tag">置顶</text>
      <text class="pinned-title-main">重要通知</text>
    </view>
    <view
      v-for="n in notices"
      :key="n.id"
      class="pinned-card"
      :class="priorityClass(n.priority)"
      @tap="$emit('view', n)"
    >
      <view class="pinned-line">
        <text class="pinned-prio">{{ priorityLabel(n.priority) }}</text>
        <text class="pinned-time">{{ formatDate(n.created_at) }}</text>
      </view>
      <text class="pinned-title">{{ n.title }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  notices: { type: Array, default: () => [] }
})

const emit = defineEmits(['view'])

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
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

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
</style>
