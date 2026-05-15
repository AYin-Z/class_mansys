<template>
  <view class="submit-page">
    <custom-nav-bar title="提交建议" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="privacy-notice">
        <text class="notice-icon">🔒</text>
        <text class="notice-text">您的建议将匿名提交，仅区队干部可见</text>
      </view>

      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">建议标题</text><input class="solid-input" placeholder="请简要描述建议主题" v-model="title" /></view>
          <view class="divider"></view>
          <picker mode="selector" :range="categories" @change="(e) => category = categories[e.detail.value]">
            <view class="form-row"><text class="row-label">建议分类</text><view class="row-value"><text class="value-text">{{ category || '请选择' }}</text><text class="arrow">›</text></view></view>
          </picker>
          <view class="divider"></view>
          <view class="textarea-wrap"><text class="row-label block">详细内容</text><textarea class="solid-textarea" v-model="content" placeholder="请详细描述您的建议或意见..." /></view>
        </view>
      </view>

      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">匿名提交</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { submitSuggestion } from '@/api/suggestion'

const title = ref('')
const content = ref('')
const category = ref('')
const categories = ['学习', '生活', '纪律', '活动', '其他']

async function submit() {
  if (!content.value || content.value.trim().length < 5) {
    uni.showToast({ title: '请填写完整内容（至少 5 字）', icon: 'none' })
    return
  }
  if (!category.value) {
    uni.showToast({ title: '请选择分类', icon: 'none' })
    return
  }
  const finalContent = title.value.trim()
    ? `【${title.value.trim()}】\n${content.value.trim()}`
    : content.value.trim()

  uni.showLoading({ title: '提交中...' })
  try {
    await submitSuggestion({ content: finalContent, category: category.value })
    uni.hideLoading()
    uni.showToast({ title: '已匿名提交', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e) {
    uni.hideLoading()
  }
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.submit-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.privacy-notice {
  display: flex; align-items: center; gap: 12rpx; margin: 24rpx 32rpx;
  padding: 20rpx 24rpx; background: rgba(0,51,102,0.04); border-radius: 14rpx; border-left: 6rpx solid #003366;
}
.notice-icon { font-size: 28rpx; }
.notice-text { font-size: 24rpx; color: #43474f; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 24rpx; &:active { background: #fafbfc; } }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.row-value { display: flex; align-items: center; gap: 8rpx; }
.value-text { font-size: 28rpx; color: #191c1e; }
.arrow { font-size: 36rpx; color: #c3c6d1; }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 260rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
