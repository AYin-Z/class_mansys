<template>
  <view class="quick-actions">
    <view class="section-header">
      <text class="section-title">快捷功能</text>
      <text class="section-sub">常用模块</text>
    </view>
    <view class="actions-grid">
      <view v-for="action in actions" :key="action.key" class="action-card" @tap="$emit('navigate', action)">
        <view class="action-icon">{{ action.icon }}</view>
        <text class="action-label">{{ action.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  actions: { type: Array, default: () => [] }
})

defineEmits(['navigate'])
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

.quick-actions {
  padding: 32rpx 32rpx 8rpx;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.action-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;

  &:active { background: #f2f4f7; }
}

.action-icon { font-size: 44rpx; line-height: 1; }
.action-label {
  font-size: 22rpx;
  font-weight: 500;
  color: $on-surface;
}
</style>
