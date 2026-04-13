<template>
  <view class="apply-page">
    <custom-nav-bar title="发起挑战" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <picker mode="selector" :range="['学习', '纪律', '体能']" @change="(e) => form.type = ['study','discipline','fitness'][e.detail.value]">
            <view class="form-row"><text class="row-label">挑战类型</text><view class="row-value"><text class="value-text">{{ typeName(form.type) || '请选择' }}</text><text class="arrow">›</text></view></view>
          </picker>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">挑战标题</text><input class="solid-input" placeholder="请输入挑战标题" v-model="form.title" /></view>
          <view class="divider"></view>
          <view class="textarea-wrap"><text class="row-label block">挑战规则</text><textarea class="solid-textarea" v-model="form.rule" placeholder="描述挑战的具体规则和成功条件..." /></view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">截止日期</text><input class="solid-input" type="text" v-model="form.deadline" placeholder="选择截止日期" /></view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">发起挑战</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
const form = reactive({ type: '', title: '', rule: '', deadline: '' })
function typeName(t) { const map = { study: '学习', discipline: '纪律', fitness: '体能' }; return map[t] || '' }
function submit() {
  if (!form.type) { uni.showToast({ title: '请选择类型', icon: 'none' }); return }
  if (!form.title) { uni.showToast({ title: '请输入标题', icon: 'none' }); return }
  uni.showLoading({ title: '发布中...' })
  setTimeout(() => { uni.hideLoading(); uni.showToast({ title: '挑战已发布', icon: 'success' }); setTimeout(() => uni.navigateBack(), 1500) }, 1000)
}
</script>

<style lang="scss" scoped
> .apply-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }
.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 24p
x; &:active { background: #fafbfc; } }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.row-value { display: flex; align-items: center; gap: 8rpx; }
.value-text { font-size: 28rpx; color: #191c1e; }
.arrow { font-size: 36rpx; color: #c3c6d1; }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; &::placeholder { color: #c3c6d1; } }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 160rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>