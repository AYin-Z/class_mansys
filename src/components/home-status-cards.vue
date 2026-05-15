<template>
  <div class="system-status">
    <div class="section-header">
      <span class="section-title">本人状态</span>
      <span class="section-sub">实时数据</span>
    </div>
    <div class="status-grid">
      <div v-for="stat in statusData" :key="stat.key" class="status-card" @tap="$emit('tap', stat)">
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

defineProps({
  statusData: { type: Array, default: () => [] }
})

defineEmits(['tap'])

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

.system-status { padding: 28rpx 32rpx 8rpx; }

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.status-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  text-align: center;

  &:active { background: #f2f4f7; }
}

.stat-value {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: $primary;
  line-height: 1;
  margin-bottom: 10rpx;
  letter-spacing: 1rpx;
}

.stat-label {
  font-size: 22rpx;
  color: $on-surface-variant;
}
</style>
