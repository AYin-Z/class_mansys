<template>
  <!-- 使用 v-if 控制组件的创建和销毁 -->
  <div v-if="show" class="modal-mask" @click.self="handleCancel">
    <div class="modal-content">
      <div class="captcha-header">
        <span class="title">请完成安全验证</span>
        <span class="close-btn" @click="handleCancel">✕</span>
      </div>
      
      <div class="captcha-body">
        <!-- 显示图片验证码 -->
        <div class="captcha-image-wrapper">
          <div class="image-content">
            <img 
              v-if="captchaData.url" 
              class="captcha-img" 
              :src="captchaData.url" 
              @error="onImageError"
            />
            <div v-else class="captcha-placeholder">
              <span>验证码加载中...</span>
            </div>
            <!-- 刷新时的加载动画 -->
            <div v-if="isRefreshing" class="refresh-overlay">
              <span class="loading-spinner"></span>
              <span>刷新中...</span>
            </div>
          </div>
          <!-- 刷新按钮 -->
          <div class="refresh-action" @click="handleRefresh">
            <span class="refresh-text">看不清？换一张</span>
          </div>
        </div>
        
        <!-- 验证码输入框 -->
        <input 
          class="captcha-input" 
          v-model="captchaCode" 
          placeholder="请输入验证码" 
          maxlength="6"
          @keyup.enter="handleSubmit"
        />
      </div>
      
      <div class="captcha-actions">
        <button class="action-btn cancel-btn" @click="handleCancel">取消</button>
        <button 
          class="action-btn confirm-btn" 
          :class="{ disabled: !captchaCode || loading }"
          @click="handleSubmit" 
          :disabled="!captchaCode || loading"
        >
          {{ loading ? '验证中...' : '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { ref, watch } from 'vue'
import { auth } from '../utils/cloudbase'
const emit = defineEmits<{
  resolve: [result: any]
}>()

const captchaCode = ref('')
const captchaData = ref<{ url: string; token: string; [key: string]: any }>({ url: '', token: '' }) 
const state = ref('')
const loading = ref(false)
const show = ref(false)
const isRefreshing = ref(false)

const onImageError = () => {
  console.error('验证码图片加载失败')
}

// 刷新验证码
const handleRefresh = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  const { token, data } = await auth.createCaptchaData({
    state: state.value,
  })
  captchaData.value.token = token
  captchaData.value.url = data
  isRefreshing.value = false 
}

// 打开验证码弹窗
const openCaptcha = (data: any) => {
  captchaData.value = data
  state.value = data.state
  captchaCode.value = ''
  show.value = true
}

// 关闭验证码弹窗
const closeCaptcha = () => {
  show.value = false
}

const handleCancel = () => {
  closeCaptcha()
}

// 提交验证码
const handleSubmit = async () => {
  if (!captchaCode.value || loading.value) return
  loading.value = true
  try {
    const result = await auth.verifyCaptcha({
      token: captchaData.value.token,
      code: captchaCode.value,
      state: state.value,
    })
    closeCaptcha()
    emit('resolve', result)
  } catch (e) {
    console.error('验证失败:', e)
    // 自动刷新验证码
    captchaCode.value = ''
    await handleRefresh()
  } finally {
    loading.value = false
  }
}

// 暴露方法给父组件
defineExpose({
  openCaptcha,
  closeCaptcha
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  width: 85%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}

.captcha-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 32rpx 0;
  
  .title {
    font-size: 32rpx;
    font-weight: 700;
    color: $on-surface;
  }
  .close-btn {
    font-size: 36rpx;
    color: $on-surface-tertiary;
    cursor: pointer;
    padding: 8rpx;
  }
}

.captcha-body {
  padding: 32rpx;
}

.captcha-image-wrapper {
  margin-bottom: 24rpx;
}

.image-content {
  position: relative;
  width: 100%;
  min-height: 160rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.captcha-img {
  width: 100%;
  height: auto;
  display: block;
}

.captcha-placeholder {
  color: $on-surface-tertiary;
  font-size: 24rpx;
}

.refresh-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: #fff;
  font-size: 24rpx;
}

.loading-spinner {
  width: 28rpx;
  height: 28rpx;
  border: 4rpx solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.refresh-action {
  text-align: center;
  margin-top: 16rpx;

  .refresh-text {
    color: $primary;
    font-size: 24rpx;
    cursor: pointer;
  }
}

.captcha-input {
  width: 100%;
  padding: 24rpx;
  border: 2rpx solid $surface-container;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  outline: none;

  &:focus {
    border-color: $primary;
  }
}

.captcha-actions {
  display: flex;
  gap: 20rpx;
  padding: 0 32rpx 32rpx;

  .action-btn {
    flex: 1;
    padding: 24rpx;
    border-radius: 12rpx;
    font-size: 28rpx;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity $transition-fast;

    &.cancel-btn {
      background: $surface-container-low;
      color: $on-surface;
    }
    &.confirm-btn {
      background: $primary;
      color: $on-primary;
      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    &:active:not(.disabled) {
      opacity: 0.85;
    }
  }
}
</style>
