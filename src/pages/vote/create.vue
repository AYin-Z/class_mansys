<template>
  <view class="create-page">
    <custom-nav-bar title="创建投票" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">投票标题</text><input class="solid-input" placeholder="请输入标题" v-model="form.title" /></view>
          <view class="divider"></view>
          <view class="textarea-wrap"><text class="row-label block">投票描述</text><textarea class="solid-textarea small" v-model="form.desc" placeholder="简要说明（选填）" /></view>
          <view class="divider"></view>
          <picker mode="selector" :range="['单选', '多选']" @change="(e) => form.type = e.detail.value === 0 ? 'single' : 'multiple'">
            <view class="form-row"><text class="row-label">投票类型</text><view class="row-value"><text class="value-text">{{ form.type === 'single' ? '单选' : '多选' }}</text><text class="arrow">›</text></view></view>
          </picker>

          <!-- Options -->
          <view class="options-area">
            <text class="section-sub">选项列表</text>
            <view v-for="(opt, idx) in options" :key="idx" class="option-row">
              <input class="opt-input" :placeholder="'选项' + (idx + 1)" v-model="options[idx]" />
              <text class="remove-opt" @tap="removeOption(idx)" v-if="options.length > 2">×</text>
            </view>
            <button class="add-option-btn" @click="addOption"><text class="add-opt-text">+ 添加选项</text></button>
          </view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">发布投票</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
const form = reactive({ title: '', desc: '', type: 'single' })
const options = reactive(['', ''])
function addOption() { if (options.length < 8) options.push('') }
function removeOption(idx) { if (options.length > 2) options.splice(idx, 1) }
function submit() {
  if (!form.title) { uni.showToast({ title: '请输入标题', icon: 'none' }); return }
  const validOpts = options.filter(o => o.trim())
  if (validOpts.length < 2) { uni.showToast({ title: '至少需要2个选项', icon: 'none' }); return }
  uni.showLoading({ title: '发布中...' })
  setTimeout(() => { uni.hideLoading(); uni.showToast({ title: '发布成功', icon: 'success' }); setTimeout(() => uni.navigateBack(), 1500) }, 1000)
}
</script>

<style lang="scss" scoped
> .create-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 24px; &:active { background: #fafbfc; } }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.row-value { display: flex; align-items: center; gap: 8rpx; }
.value-text { font-size: 28rpx; color: #191c1e; }
.arrow { font-size: 36rpx; color: #c3c6d1; }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 120rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &.small { min-height: 100rpx; } &::placeholder { color: #c3c6d1; } }

.options-area { padding: 24rpx; background: #fafbfc; margin-top: 12rpx; border-radius: 14rpx; }
.section-sub { font-size: 24rpx; font-weight: 600; color: #43474f; display: block; margin-bottom: 16rpx; }
.option-row { display: flex; align-items: center; gap: 10rpx; margin-bottom: 12rpx; }
.opt-input { flex: 1; height: 64rpx; font-size: 27rpx; background: #fff; border-radius: 12rpx; padding: 0 18rpx; border: none; &::placeholder { color: #c3c6d1; } }
.remove-opt { width: 48rpx; height: 48rpx; text-align: center; line-height: 48rpx; font-size: 32rpx; color: #460002; }
.add-option-btn { background: transparent; border: 2rpx dashed rgba(195,198,209,0.5); border-radius: 14rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; &::after { display: none; } &:active { background: rgba(195,198,209,0.15); } }
.add-opt-text { font-size: 26rpx; color: #43474f; }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>