<template>
  <view class="recent-updates">
    <view class="section-header">
      <text class="section-title">最新动态</text>
      <text class="section-sub">区队最新通知</text>
    </view>
    <view v-if="updates.length === 0" class="empty-card">
      <text class="empty-text">暂无通知</text>
    </view>
    <view
      v-for="update in updates"
      :key="update.id"
      class="update-card"
      @tap="$emit('view', update)"
    >
      <view class="update-icon" :class="priorityClass(update.priority)">
        <text class="update-icon-text">{{ priorityIcon(update.priority) }}</text>
      </view>
      <view class="update-content">
        <text class="update-title">{{ update.title }}</text>
        <text class="update-time">{{ formatDate(update.created_at) }} · {{ update.creator_nickname || update.creator_name || '系统' }}</text>
      </view>
      <text class="update-arrow">›</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  updates: { type: Array, default: () => [] }
})

const emit = defineEmits(['view'])

function priorityClass(p) {
  if (p >= 2) return 'urgent'
  if (p === 1) return 'important'
  return 'normal'
}
function priorityIcon(p) {
  if (p >= 2) return '⚠'
  if (p === 1) return '★'
  return '•'
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

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $on-surface;
  letter-spacing: 1rpx;
}

.section-sub {
  font-size: 22rpx;
  color: $on-surface-tertiary;
}

.recent-updates { padding: 28rpx 32rpx 0; }

.empty-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 60rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 24rpx;
  color: $on-surface-tertiary;
}

.update-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 14rpx;

  &:active { background: #f2f4f7; }
}

.update-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.urgent    { background: rgba(70, 0, 2, 0.08); color: #460002; }
  &.important { background: rgba(184, 134, 11, 0.10); color: #8b6914; }
  &.normal    { background: rgba(0, 30, 64, 0.06); color: $primary; }
}

.update-icon-text { font-size: 32rpx; font-weight: 700; }

.update-content { flex: 1; min-width: 0; }

.update-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $on-surface;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-time {
  font-size: 22rpx;
  color: $on-surface-tertiary;
}

.update-arrow {
  font-size: 36rpx;
  color: $on-surface-tertiary;
  flex-shrink: 0;
}
</style>
