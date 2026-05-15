<template>
  <view class="tab-bar" :style="{ paddingBottom: safeAreaBottom + 'px' }">
    <view
      v-for="item in visibleTabs"
      :key="item.key"
      class="tab-item"
      :class="{ active: item.key === current }"
      @tap="onTap(item)"
    >
      <view class="tab-icon-wrap">
        <text class="tab-icon">{{ item.key === current ? item.iconActive : item.icon }}</text>
        <text v-if="item.key === 'notice' && unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</text>
      </view>
      <text class="tab-label">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSystemInfo } from '@/composables/useSystemInfo'
import { getUnreadCount } from '@/api/notice'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  current: {
    type: String,
    required: true,
    validator: v => ['home', 'notice', 'homework', 'leave', 'profile', 'dashboard'].includes(v)
  }
})

const { safeAreaBottom } = useSystemInfo()
const store = useUserStore()
const unreadCount = ref(0)

onMounted(async () => {
  try {
    const res = await getUnreadCount()
    if (res?.success) unreadCount.value = res.count || 0
  } catch (_) {}
})

const allTabs = [
  { key: 'home',     label: '首页',   icon: '🏠', iconActive: '🏠', url: '/pages/index/index' },
  { key: 'notice',   label: '通知',   icon: '🔔', iconActive: '🔔', url: '/pages/notice/index' },
  { key: 'homework', label: '作业',   icon: '📝', iconActive: '📝', url: '/pages/homework/index' },
  { key: 'leave',    label: '请假',   icon: '📋', iconActive: '📋', url: '/pages/leave/index' },
  { key: 'profile',  label: '我的',   icon: '👤', iconActive: '👤', url: '/pages/profile/index' },
  { key: 'dashboard', label: '仪表盘', icon: '📊', iconActive: '📊', url: '/pages/dashboard/index' },
]

const visibleTabs = computed(() => {
  const isCadre = store.isAdmin
  if (isCadre) return allTabs
  // 非干部：不显示仪表盘
  return allTabs.filter(t => t.key !== 'dashboard')
})

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

.tab-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.badge {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 6rpx;
  background: #b3261e;
  color: #fff;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 28rpx;
  text-align: center;
  border-radius: 14rpx;
  white-space: nowrap;
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
