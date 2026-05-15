<template>
  <view class="create-page">
    <custom-nav-bar title="创建抽奖" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">活动名称</text><input class="solid-input" placeholder="请输入活动名称" v-model="form.name" /></view>
          <view class="textarea-wrap"><text class="row-label block">活动简介</text><textarea class="solid-textarea small" v-model="form.description" placeholder="选填" /></view>
          <view class="textarea-wrap"><text class="row-label block">活动规则</text><textarea class="solid-textarea" v-model="form.rules" placeholder="奖品、参与方式、开奖时间等" /></view>
          <view class="form-row">
            <text class="row-label block">开始日期</text>
            <picker mode="date" :value="form.startDate" @change="(e) => form.startDate = e.detail.value">
              <view class="solid-input picker-display">{{ form.startDate || '请选择' }}</view>
            </picker>
          </view>
          <view class="form-row">
            <text class="row-label block">结束日期</text>
            <picker mode="date" :value="form.endDate" @change="(e) => form.endDate = e.detail.value">
              <view class="solid-input picker-display">{{ form.endDate || '请选择' }}</view>
            </picker>
          </view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">创建抽奖</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
import { createLottery } from '@/api/lottery'

const form = reactive({ name: '', description: '', rules: '', startDate: '', endDate: '' })

async function submit() {
  if (!form.name) { uni.showToast({ title: '请输入名称', icon: 'none' }); return }
  if (!form.rules) { uni.showToast({ title: '请输入规则', icon: 'none' }); return }
  if (!form.startDate || !form.endDate) { uni.showToast({ title: '请选择起止日期', icon: 'none' }); return }

  uni.showLoading({ title: '创建中...' })
  try {
    await createLottery({
      name: form.name,
      description: form.description,
      rules: form.rules,
      start_time: `${form.startDate} 00:00:00`,
      end_time: `${form.endDate} 23:59:59`
    })
    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1200)
  } catch (_) { uni.hideLoading() }
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.create-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 24rpx; }
.row-label { font-size: 26rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 12rpx; } }
.solid-input { width: 100%; height: 60rpx; line-height: 60rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.picker-display { color: #191c1e; }
.textarea-wrap { padding: 24rpx; }
.solid-textarea { width: 100%; min-height: 140rpx; font-size: 26rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 16rpx; border: none; box-sizing: border-box; &.small { min-height: 90rpx; } &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
