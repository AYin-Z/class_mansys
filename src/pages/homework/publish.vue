<template>
  <view class="publish-page">
    <custom-nav-bar title="发布作业" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">作业标题</text><input class="solid-input" placeholder="请输入标题" v-model="form.title" /></view>
          <view class="textarea-wrap"><text class="row-label block">作业要求</text><textarea class="solid-textarea" v-model="form.description" placeholder="详细描述作业要求..." /></view>
          <view class="form-row">
            <text class="row-label block">截止日期</text>
            <picker mode="date" :value="form.deadlineDate" @change="onDateChange">
              <view class="solid-input picker-display">{{ form.deadlineDate || '请选择日期' }}</view>
            </picker>
          </view>
          <view class="form-row">
            <text class="row-label block">截止时间</text>
            <picker mode="time" :value="form.deadlineTime" @change="onTimeChange">
              <view class="solid-input picker-display">{{ form.deadlineTime || '请选择时间' }}</view>
            </picker>
          </view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">发布作业</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
import { createHomework } from '@/api/homework'

const form = reactive({ title: '', description: '', deadlineDate: '', deadlineTime: '23:59' })

function onDateChange(e) { form.deadlineDate = e.detail.value }
function onTimeChange(e) { form.deadlineTime = e.detail.value }

async function submit() {
  if (!form.title) { uni.showToast({ title: '请输入标题', icon: 'none' }); return }
  if (!form.description) { uni.showToast({ title: '请输入要求', icon: 'none' }); return }
  if (!form.deadlineDate) { uni.showToast({ title: '请选择截止日期', icon: 'none' }); return }

  const deadline = `${form.deadlineDate} ${form.deadlineTime || '23:59'}:00`
  uni.showLoading({ title: '发布中...' })
  try {
    const res = await createHomework({ title: form.title, description: form.description, deadline })
    uni.hideLoading()
    if (res?.success) {
      uni.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 1200)
    }
  } catch (e) {
    uni.hideLoading()
  }
}
</script>

<style lang="scss" scoped>
.publish-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; line-height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.picker-display { color: #191c1e; }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 200rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
