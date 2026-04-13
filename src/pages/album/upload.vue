<template>
  <view class="upload-page">
    <custom-nav-bar title="上传照片" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="photo-grid">
        <view v-for="(img, idx) in photos" :key="idx" class="photo-item">
          <image :src="img" mode="aspectFill" class="photo-img" />
          <view class="remove-btn" @tap.stop="removePhoto(idx)"><text class="remove-x">×</text></view>
        </view>
        <view class="add-photo" @tap="choosePhoto"><text class="add-icon">+</text></view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">上传 ({{ photos.length }}张)</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const photos = ref([])
function choosePhoto() { uni.chooseImage({ count: 9, success: (res) => { photos.value.push(...res.tempFilePaths) } }) }
function removePhoto(idx) { photos.value.splice(idx, 1) }
function submit() {
  if (photos.value.length === 0) { uni.showToast({ title: '请选择照片', icon: 'none' }); return }
  uni.showLoading({ title: '上传中...' })
  setTimeout(() => { uni.hideLoading(); uni.showToast({ title: `上传${photos.value.length}张成功`, icon: 'success' }); setTimeout(() => uni.navigateBack(), 1500) }, 1500)
}
</script>

<style lang="scss" scoped
> .upload-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.photo-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; padding: 24rpx 32rpx;
}
.photo-item { position: relative; width: 100%; aspect-ratio: 1; border-radius: 14rpx; overflow: hidden; }
.photo-img { width: 100%; height: 100%; }
.remove-btn {
  position: absolute; top: 6rpx; right: 6rpx; width: 40rpx; height: 40rpx;
  background: rgba(70,0,2,0.8); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.remove-x { color: #fff; font-size: 28rpx; line-height: 1; }
.add-photo {
  aspect-ratio: 1; border: 2rpx dashed rgba(195,198,209,0.5); border-radius: 14rpx;
  display: flex; align-items: center; justify-content: center;
}
.add-icon { font-size: 56rpx; color: #c3c6d1; }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>