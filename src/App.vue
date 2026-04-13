<template>
  <view class="app-container">
    <slot></slot>
  </view>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // 初始化微信云开发
  if (typeof wx !== 'undefined' && wx.cloud) {
    wx.cloud.init({
      env: 'your-cloud-env-id', // 替换为你的云开发环境ID
      traceUser: true
    })
  }
})
</script>

<style lang="scss">
@import "./uni.scss";

/* Global Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: $font-body;
  font-size: $body-md;
  color: $on-surface;
  background: $surface;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Page Container */
.app-container {
  min-height: 100vh;
  background: $surface;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 6rpx;
  height: 6rpx;
}

::-webkit-scrollbar-track {
  background: $surface-container-low;
  border-radius: 3rpx;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 30, 64, 0.2);
  border-radius: 3rpx;
  &:hover {
    background: rgba(0, 30, 64, 0.3);
  }
}

/* Loading Toast */
uni-loading {
  --uni-loading-color: $primary !important;
}

/* Modal */
uni-modal {
  --uni-modal-background-color: $surface-container-lowest !important;
  --uni-modal-title-color: $on-surface !important;
  --uni-modal-content-color: $on-surface-variant !important;
  --uni-modal-button-color: $primary !important;
  --uni-modal-border-radius: $radius-lg !important;
}

/* Action Sheet */
uni-action-sheet {
  --uni-action-sheet-background-color: $surface-container-lowest !important;
  --uni-action-sheet-button-color: $on-surface !important;
  --uni-action-sheet-cancel-color: $on-surface-tertiary !important;
  --uni-action-sheet-separator-color: $surface-container-low !important;
}

/* Picker */
uni-picker {
  --uni-picker-background-color: $surface-container-lowest !important;
  --uni-picker-text-color: $on-surface !important;
  --uni-picker-confirm-color: $primary !important;
  --uni-picker-cancel-color: $on-surface-tertiary !important;
}

/* Input */
uni-input {
  font-family: $font-body;
  font-size: $body-md;
  color: $on-surface;
  
  &::placeholder {
    color: $on-surface-tertiary;
  }
}

/* Button */
uni-button {
  font-family: $font-display;
  font-weight: $font-weight-semibold;
  
  &[type="primary"] {
    background: $gradient-primary !important;
    color: #ffffff !important;
    border: none !important;
  }
  
  &[type="default"] {
    background: $surface-container-low !important;
    color: $on-surface !important;
    border: none !important;
  }
  
  &[type="warn"] {
    background: $tertiary-container !important;
    color: $tertiary !important;
    border: none !important;
  }
}

/* TabBar */
.uni-tabbar {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(40rpx) !important;
  -webkit-backdrop-filter: blur(40rpx) !important;
  border-top: 1rpx solid rgba(195, 198, 209, 0.2) !important;
  
  .uni-tabbar__item {
    &.uni-tabbar__item--active {
      .uni-tabbar__label {
        color: $primary !important;
        font-weight: $font-weight-semibold !important;
      }
    }
    
    .uni-tabbar__label {
      font-family: $font-body;
      font-size: $label-sm;
      color: $on-surface-tertiary !important;
      margin-top: 4rpx !important;
    }
  }
}
</style>