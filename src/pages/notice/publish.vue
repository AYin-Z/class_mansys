<template>
  <view class="publish-page">
    <custom-nav-bar title="发布通知" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="section-label">
          <text class="label-text">通知内容</text>
        </view>

        <view class="form-card">
          <view class="form-row">
            <text class="row-label block">通知标题</text>
            <input class="solid-input" placeholder="请输入通知标题" v-model="formData.title" />
          </view>

          <view class="divider"></view>

          <picker mode="selector" :range="typeOptions" @change="onTypeChange">
            <view class="form-row">
              <text class="row-label">类型</text>
              <view class="row-value">
                <text class="value-text">{{ formData.type || '请选择' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>

          <view class="divider"></view>

          <picker mode="selector" :range="priorityOptions" @change="onPriorityChange">
            <view class="form-row">
              <text class="row-label">优先级</text>
              <view class="row-value">
                <text class="value-text">{{ formData.priorityLabel || '请选择' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>

          <view class="divider"></view>

          <view class="form-row toggle-row" @tap="formData.is_pinned = !formData.is_pinned">
            <text class="row-label">置顶</text>
            <view :class="['toggle', { on: formData.is_pinned }]">
              <view class="toggle-knob"></view>
            </view>
          </view>

          <view class="divider"></view>

          <view class="textarea-wrap">
            <text class="row-label block">通知正文</text>
            <textarea class="solid-textarea" v-model="formData.content" placeholder="请输入通知内容..." />
          </view>
        </view>

        <view class="section-label mt-lg">
          <text class="label-text">附件（可选）</text>
        </view>

        <view class="upload-area" @tap="chooseFile">
          <text class="upload-icon">📎</text>
          <text class="upload-text">点击上传附件</text>
          <text class="upload-hint">支持PDF、图片、文档等格式</text>
        </view>
      </view>

      <view class="bottom-action">
        <button class="primary-btn" @click="onPublish">
          <text class="btn-text">发布通知</text>
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { createNotice } from '@/api/notice'

const priorityOptions = ['日常', '重要', '紧急']
const typeOptions = ['系统通知', '集合通知', '学习通知', '活动通知', '其他']
const formData = reactive({
  title: '',
  type: '',
  priority: 0,
  priorityLabel: '日常',
  is_pinned: false,
  content: '',
  attachments: []
})

function onPriorityChange(e) {
  const idx = e.detail.value
  formData.priority = idx
  formData.priorityLabel = priorityOptions[idx]
}

function onTypeChange(e) {
  const idx = e.detail.value
  formData.type = typeOptions[idx]
}

function chooseFile() {
  uni.chooseMessageFile({
    count: 5,
    success: (res) => {
      formData.attachments = res.tempFiles
    }
  })
}

async function onPublish() {
  if (!formData.title) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  if (!formData.content) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }

  uni.showLoading({ title: '发布中...' })
  try {
    if (!formData.type) {
      uni.hideLoading()
      uni.showToast({ title: '请选择通知类型', icon: 'none' })
      return
    }
    const res = await createNotice({
      title: formData.title,
      content: formData.content,
      type: formData.type,
      priority: formData.priority,
      is_pinned: formData.is_pinned
    })
    uni.hideLoading()
    if (res.success) {
      uni.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    } else {
      uni.showToast({ title: res.message || '发布失败', icon: 'none' })
    }
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '网络错误，请重试', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.publish-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: 140rpx;
}

.form-area {
  padding: 32rpx;
}

.section-label {
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.label-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #43474f;
  text-transform: uppercase;
  letter-spacing: 4rpx;
}

.mt-lg {
  margin-top: 48rpx;
}

.form-card {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.form-row {
  padding: 28rpx 24rpx;
}

.row-label {
  font-size: 28rpx;
  font-weight: 500;
  color: #191c1e;

  &.block {
    display: block;
    margin-bottom: 16rpx;
  }
}

.solid-input {
  width: 100%;
  height: 60rpx;
  font-size: 30rpx;
  color: #191c1e;
  background: #f7f9fc;
  border-radius: 12rpx;
  padding: 0 20rpx;
  border: none;

  &::placeholder {
    color: #c3c6d1;
  }
}

.row-value {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.value-text {
  font-size: 28rpx;
  color: #191c1e;
}

.arrow {
  font-size: 36rpx;
  color: #c3c6d1;
}

.divider {
  height: 1rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
  background: transparent;
}

.textarea-wrap {
  padding: 28rpx 24rpx;
}

.solid-textarea {
  width: 100%;
  min-height: 280rpx;
  font-size: 28rpx;
  color: #191c1e;
  background: #f7f9fc;
  border-radius: 12rpx;
  padding: 20rpx;
  border: none;
  box-sizing: border-box;

  &::placeholder {
    color: #c3c6d1;
  }
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle {
  width: 80rpx;
  height: 44rpx;
  border-radius: 999rpx;
  background: #d8dde5;
  position: relative;
  transition: background 0.2s;

  &.on {
    background: #001e40;

    .toggle-knob {
      transform: translateX(36rpx);
    }
  }
}

.toggle-knob {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #ffffff;
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  transition: transform 0.2s;
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.1);
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 48rpx 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  border: 2rpx dashed rgba(195,198,209,0.4);

  &:active {
    background: #fafbfc;
  }
}

.upload-icon {
  font-size: 48rpx;
}

.upload-text {
  font-size: 28rpx;
  color: #191c1e;
  font-weight: 500;
}

.upload-hint {
  font-size: 22rpx;
  color: #c3c6d1;
}

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
  z-index: 100;
}

.primary-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
  border-radius: 20rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25);

  &:active {
    transform: scale(0.98);
  }
}

.btn-text {
  font-family: 'PingFang SC', sans-serif;
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>