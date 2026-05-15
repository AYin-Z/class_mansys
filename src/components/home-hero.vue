<template>
  <view class="hero-section">
    <view class="hero-card">
      <view class="hero-top">
        <image class="hero-avatar" :src="avatar" mode="aspectFill" />
        <view class="hero-meta">
          <text class="hero-greeting">{{ greeting }}</text>
          <text class="hero-name">{{ displayName }}</text>
          <view class="hero-tags">
            <text class="hero-tag primary">{{ roleLabel }}</text>
            <text v-if="classId" class="hero-tag">{{ classId }}</text>
          </view>
        </view>
      </view>
      <view class="hero-bottom">
        <text class="hero-date">{{ currentDate }}</text>
        <text v-if="studentId" class="hero-sid">学号 {{ studentId }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  avatar: { type: String, default: '' },
  displayName: { type: String, default: '' },
  roleLabel: { type: String, default: '' },
  classId: { type: String, default: '' },
  studentId: { type: String, default: '' },
  currentDate: { type: String, default: '' },
  greeting: { type: String, default: '' }
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.hero-section { padding: 24rpx 32rpx 8rpx; }

.hero-card {
  position: relative;
  padding: 36rpx 32rpx 28rpx;
  border-radius: 28rpx;
  background: $gradient-primary;
  color: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(0, 30, 64, 0.28);
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    right: -60rpx;
    top: -80rpx;
    width: 280rpx;
    height: 280rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 50%;
    pointer-events: none;
  }
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.hero-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.hero-meta {
  flex: 1;
  min-width: 0;
}

.hero-greeting {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 6rpx;
  letter-spacing: 1rpx;
}

.hero-name {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 1rpx;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.hero-tag {
  display: inline-block;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.92);

  &.primary {
    background: rgba(255, 255, 255, 0.92);
    color: $primary;
    font-weight: 600;
  }
}

.hero-bottom {
  margin-top: 28rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-date {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.hero-sid {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 1rpx;
}
</style>
