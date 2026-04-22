<template>
  <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="nav-content" :style="{ height: navBarHeight + 'px' }">
      <view class="nav-left" v-if="showBack" @tap="goBack">
        <view class="back-btn">
          <text class="back-icon">‹</text>
        </view>
        <text class="nav-title">{{ title }}</text>
      </view>
      <view class="nav-center" v-else>
        <text class="nav-title center">{{ title }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  showBack: {
    type: Boolean,
    default: false
  }
})

const statusBarHeight = ref(20)
const navBarHeight = ref(44)

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 20
})

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/index/index' }) })
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: $z-index-nav;
  @include glass-effect;
}

.nav-content {
  display: flex;
  align-items: center;
  padding: 0 $spacing-sm;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.nav-center {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color $transition-fast;
  
  &:active {
    background: rgba(0, 30, 64, 0.06);
  }
}

.back-icon {
  font-size: 48rpx;
  color: $primary;
  line-height: 1;
  font-weight: $font-weight-light;
}

.nav-title {
  font-family: $font-display;
  font-size: 32rpx;
  font-weight: $font-weight-semibold;
  color: $primary;
  
  &.center {
    text-align: center;
  }
}
</style>