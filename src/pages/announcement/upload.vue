<template>
  <view class="upload-page">
    <custom-nav-bar title="上传资源" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">资源名称</text><input class="solid-input" placeholder="请输入资源名称" v-model="name" /></view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">资源描述</text><input class="solid-input" placeholder="简要描述（选填）" v-model="desc" /></view>
          <view class="divider"></view>
          <view class="upload-section"><text class="row-label block">选择文件</text>
            <view class="upload-area" @tap="chooseFile"><text class="upload-icon">📁</text><text class="upload-text">{{ fileName || '点击选择文件' }}</text></view>
          </view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">上传</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const name = ref(''), desc = ref(''), fileName = ref('')
function chooseFile() { uni.chooseMessageFile({ count: 1, success: (res) => { fileName.value = res.tempFiles[0].name } }) }
function submit() {
  if (!name.value) { uni.showToast({ title: '请输入名称', icon: 'none' }); return }
  if (!fileName.value) { uni.showToast({ title: '请选择文件', icon: 'none' }); return }
  uni.showLoading({ title: '上传中...' })
  setTimeout(() => { uni.hideLoading(); uni.showToast({ title: '上传成功', icon: 'success' }); setTimeout(() => uni.navigateBack(), 1500) }, 1500)
}
</script>

<style lang="scss" scoped
> .upload-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }
.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; &::placeholder { color: #c3c6d1; } }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.upload-section { padding: 28rpx 24rpx; }
.upload-area { display: flex; align-items: center; gap: 16rpx; padding: 32rpx 20rpx; background: #f7f9fc; border-radius: 14rpx; border: 2rpx dashed rgba(195,198,209,0.4); &:active { background: #fafbfc; } }
.upload-icon { font-size: 40rpx; }
.upload-text { font-size: 27rpx; color: #191c1e; &.placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>