<template>
  <view class="publish-page">
    <custom-nav-bar title="发布作业" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">课程名称</text><input class="solid-input" placeholder="请输入课程" v-model="form.course" /></view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">作业标题</text><input class="solid-input" placeholder="请输入标题" v-model="form.title" /></view>
          <view class="divider"></view>
          <view class="textarea-wrap"><text class="row-label block">作业要求</text><textarea class="solid-textarea" v-model="form.requirement" placeholder="详细描述作业要求..." /></view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">截止时间</text><input class="solid-input" placeholder="选择截止时间" v-model="form.deadline" /></view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">发布作业</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
const form = reactive({ course: '', title: '', requirement: '', deadline: '' })
function submit() {
  if (!form.title) { uni.showToast({ title: '请输入标题', icon: 'none' }); return }
  if (!form.deadline) { uni.showToast({ title: '请选择截止时间', icon: 'none' }); return }
  uni.showLoading({ title: '发布中...' })
  setTimeout(() => { uni.hideLoading(); uni.showToast({ title: '发布成功', icon: 'success' }); setTimeout(() => uni.navigateBack(), 1500) }, 1000)
}
</script>

<style lang="scss" scoped
> .publish-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 200rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>