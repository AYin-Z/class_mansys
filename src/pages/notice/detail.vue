<template>
  <view class="detail-page">
    <custom-nav-bar title="通知详情" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <!-- Header -->
      <view class="detail-header">
        <view :class="['priority-banner', priorityClass(notice.priority)]">
          <text class="priority-text">{{ priorityLabel(notice.priority) }}</text>
        </view>
        <text class="detail-title">{{ notice.title }}</text>
        <view class="meta-row">
          <text class="meta-item">{{ notice.author }}</text>
          <text class="meta-dot">·</text>
          <text class="meta-item">{{ notice.time }}</text>
        </view>
      </view>

      <!-- Content -->
      <view class="content-card">
        <rich-text :nodes="notice.content"></rich-text>
      </view>

      <!-- Attachments -->
      <view class="section-block" v-if="notice.attachments && notice.attachments.length > 0">
        <text class="block-title">附件</text>
        <view class="attachment-list">
          <view v-for="(file, idx) in notice.attachments" :key="idx" class="attachment-item" @tap="downloadFile(file)">
            <text class="file-icon">📎</text>
            <text class="file-name">{{ file.name }}</text>
            <text class="file-size">{{ file.size }}</text>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const notice = ref({
  id: 1,
  title: '关于期末考试安排的重要通知',
  priority: 1,
  author: '区队长',
  time: '2026-04-09 10:00',
  content: '<p style="font-size:28rpx;color:#191c1e;line-height:1.8;">各位同学：</p><p style="font-size:28rpx;color:#43474f;line-height:1.8;margin-top:16rpx;">根据学校教学安排，本学期期末考试将于6月中旬开始进行。现将有关事项通知如下：</p><p style="font-size:28rpx;color:#43474f;line-height:1.8;margin-top:16rpx;"><strong>一、考试时间</strong></p><p style="font-size:28rpx;color:#43474f;line-height:1.8;margin-top:12rpx;">2026年6月15日 - 6月25日</p><p style="font-size:28rpx;color:#43474f;line-height:1.8;margin-top:16rpx;"><strong>二、注意事项</strong></p><p style="font-size:28rpx;color:#43474f;line-height:1.8;margin-top:12rpx;">1. 请携带学生证和身份证参加考试<br/>2. 提前30分钟到达考场<br/>3. 考试期间关闭手机等电子设备</p>',
  attachments: [
    { name: '期末考试安排表.pdf', size: '2.3MB', url: '' },
    { name: '考场分布图.png', size: '1.1MB', url: '' }
  ]
})

function priorityClass(p) {
  if (p === 2) return 'urgent'
  if (p === 1) return 'important'
  return 'daily'
}

function priorityLabel(p) {
  if (p === 2) return '紧急'
  if (p === 1) return '重要'
  return '日常'
}

function downloadFile(file) {
  uni.showToast({ title: `下载：${file.name}`, icon: 'none' })
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.detail-header {
  padding: 32rpx;
}

.priority-banner {
  display: inline-flex;
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
  margin-bottom: 20rpx;

  &.urgent { background: rgba(70,0,2,0.08); }
  &.important { background: rgba(0,30,64,0.06); }
  &.daily { background: rgba(70,98,112,0.08); }
}

.priority-text {
  font-size: 22rpx;
  font-weight: 600;

  .urgent & { color: #460002; }
  .important & { color: #001e40; }
  .daily & { color: #466270; }
}

.detail-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 36rpx;
  font-weight: 700;
  color: #191c1e;
  line-height: 1.4;
  display: block;
  margin-bottom: 16rpx;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #c3c6d1;
}

.meta-dot {
  font-size: 24rpx;
  color: #c3c6d1;
}

.content-card {
  margin: 0 32rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
}

.section-block {
  margin: 32rpx 32rpx 0;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
}

.block-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 26rpx;
  font-weight: 600;
  color: #191c1e;
  display: block;
  margin-bottom: 20rpx;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 20rpx;
  background: #f2f4f7;
  border-radius: 14rpx;

  &:active {
    opacity: 0.75;
  }
}

.file-icon {
  font-size: 32rpx;
}

.file-name {
  flex: 1;
  font-size: 26rpx;
  color: #191c1e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 22rpx;
  color: #c3c6d1;
  flex-shrink: 0;
}
</style>