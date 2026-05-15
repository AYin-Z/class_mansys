<template>
  <view class="quick-actions">
    <!-- Section Header -->
    <view class="section-header">
      <view class="header-left">
        <text class="section-title">快捷功能</text>
        <text class="section-sub">常用模块</text>
      </view>
      <view class="header-right" @tap="showAll = true">
        <text class="all-link">全部功能</text>
        <text class="all-arrow">›</text>
      </view>
    </view>

    <!-- 4 Most Used -->
    <view class="actions-row">
      <view v-for="action in quickActions" :key="action.key" class="action-card" @tap="$emit('navigate', action)">
        <view class="action-icon">{{ action.icon }}</view>
        <text class="action-label">{{ action.label }}</text>
      </view>
    </view>

    <!-- Resource Cards Row -->
    <view class="resource-row">
      <view class="resource-card" @tap="goResource('announcement')">
        <view class="resource-icon-wrap">
          <text class="resource-icon">📰</text>
        </view>
        <view class="resource-info">
          <text class="resource-title">公共资源</text>
          <text class="resource-desc">通知公告与附件</text>
        </view>
        <text class="resource-arrow">›</text>
      </view>
      <view class="resource-card" @tap="goResource('album')">
        <view class="resource-icon-wrap accent">
          <text class="resource-icon">📷</text>
        </view>
        <view class="resource-info">
          <text class="resource-title">区队相册</text>
          <text class="resource-desc">活动照片与回忆</text>
        </view>
        <text class="resource-arrow">›</text>
      </view>
    </view>

    <!-- All Functions Modal -->
    <view v-if="showAll" class="modal-overlay" @tap="showAll = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">全部功能</text>
          <text class="modal-close" @tap="showAll = false">✕</text>
        </view>
        <view class="modal-grid">
          <view v-for="action in allActions" :key="action.key" class="modal-item" @tap="onSelect(action)">
            <view class="modal-icon">{{ action.icon }}</view>
            <text class="modal-label">{{ action.label }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['navigate'])

const showAll = ref(false)

const quickActions = computed(() => props.actions.slice(0, 4))
const allActions = computed(() => props.actions)

function goResource(key) {
  const item = props.actions.find(a => a.key === key)
  if (item) emit('navigate', item)
}

function onSelect(action) {
  showAll.value = false
  emit('navigate', action)
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.header-left { display: flex; align-items: baseline; gap: 12rpx; }

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

.header-right {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: $surface-container-low;
  &:active { opacity: 0.7; }
}

.all-link {
  font-size: 24rpx;
  font-weight: 600;
  color: $primary;
}

.all-arrow {
  font-size: 28rpx;
  color: $primary;
  line-height: 1;
}

.quick-actions {
  padding: 28rpx 32rpx 8rpx;
}

.actions-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.action-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
  &:active { background: #f2f4f7; transform: scale(0.97); }
}

.action-icon { font-size: 44rpx; line-height: 1; }
.action-label { font-size: 22rpx; font-weight: 500; color: $on-surface; }

/* Resource Cards */
.resource-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 8rpx;
}

.resource-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 20rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
  &:active { background: #f2f4f7; }
}

.resource-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  background: rgba(70,98,112,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &.accent { background: rgba(0,30,64,0.06); }
}

.resource-icon { font-size: 32rpx; line-height: 1; }

.resource-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.resource-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $on-surface;
}

.resource-desc {
  font-size: 20rpx;
  color: $outline-variant;
}

.resource-arrow {
  font-size: 32rpx;
  color: $outline-variant;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(25,28,30,0.4);
  z-index: $z-index-modal;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-content {
  width: 100%;
  max-height: 70vh;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $on-surface;
}

.modal-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $surface-container-low;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: $on-surface-variant;
  &:active { background: $surface-container-high; }
}

.modal-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}

.modal-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 20rpx 8rpx;
  border-radius: 16rpx;
  &:active { background: $surface-container-low; }
}

.modal-icon { font-size: 48rpx; line-height: 1; }
.modal-label { font-size: 22rpx; font-weight: 500; color: $on-surface; text-align: center; }
</style>
