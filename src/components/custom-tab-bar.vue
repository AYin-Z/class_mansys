<template>
  <view class="tab-bar" :style="{ paddingBottom: safeAreaBottom + 'px' }">
    <view
      v-for="item in tabs"
      :key="item.key"
      class="tab-item"
      :class="{ active: item.key === current }"
      @tap="onTap(item)"
    >
      <text class="tab-icon">{{ item.key === current ? item.iconActive : item.icon }}</text>
      <text class="tab-label">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useSystemInfo } from '@/composables/useSystemInfo'

const props = defineProps({
  current: {
    type: String,
    required: true,
    validator: v => ['home', 'notice', 'fee', 'profile'].includes(v)
  }
})

const { safeAreaBottom } = useSystemInfo()

const tabs = [
  { key: 'home',    label: '首页',   icon: '🏠', iconActive: '🏠', url: '/pages/index/index' },
  { key: 'notice',  label: '通知',   icon: '🔔', iconActive: '🔔', url: '/pages/notice/index' },
  { key: 'fee',     label: '班费',   icon: '💰', iconActive: '💰', url: '/pages/fee/index' },
  { key: 'profile', label: '我的',   icon: '👤', iconActive: '👤', url: '/pages/profile/index' }
]

function onTap(item) {
  if (item.key === props.current) return
  uni.reLaunch({ url: item.url })
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: $z-index-nav;
  display: flex;
  align-items: stretch;
  height: 110rpx;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
  border-top: 1rpx solid rgba(0, 30, 64, 0.06);
  box-shadow: 0 -4rpx 16rpx rgba(25, 28, 30, 0.04);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  transition: transform $transition-fast;

  &:active {
    transform: scale(0.96);
  }
}

.tab-icon {
  font-size: 40rpx;
  line-height: 1;
  filter: grayscale(0.4) opacity(0.55);
  transition: filter $transition-fast;
}

.tab-label {
  font-size: $label-sm;
  color: $on-surface-tertiary;
  font-weight: $font-weight-medium;
  transition: color $transition-fast;
}

.tab-item.active {
  .tab-icon {
    filter: grayscale(0) opacity(1);
  }
  .tab-label {
    color: $primary;
    font-weight: $font-weight-semibold;
  }
}
</style>
