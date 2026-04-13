<template>
  <view class="create-page">
    <custom-nav-bar title="创建抽奖" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">活动名称</text><input class="solid-input" placeholder="请输入活动名称" v-model="form.name" /></view>
          <view class="divider"></view>
          <view class="textarea-wrap"><text class="row-label block">活动描述</text><textarea class="solid-textarea small" v-model="form.desc" placeholder="简要描述（选填）" /></view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">参与人数上限</text><input class="solid-input" type="number" placeholder="如：32" v-model="form.total" /></view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">截止时间</text><input class="solid-input" placeholder="选择截止时间" v-model="form.deadline" /></view>

          <!-- Prizes -->
          <view class="prizes-area">
            <text class="section-sub">奖品设置</text>
            <view v-for="(p, idx) in prizes" :key="idx" class="prize-input-row">
              <input class="rank-input" :placeholder="'等级'" v-model="p.rank" />
              <input class="name-input" :placeholder="'奖品名称'" v-model="p.name" />
              <input class="count-input" type="number" :placeholder="'数量'" v-model="p.count" />
              <text class="remove-prize" @tap="removePrize(idx)" v-if="prizes.length > 1">×</text>
            </view>
            <button class="add-prize-btn" @click="addPrize"><text class="add-p-text">+ 添加奖品</text></button>
          </view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">创建抽奖</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
const form = reactive({ name: '', desc: '', total: '', deadline: '' })
const prizes = reactive([{ rank: '一等奖', name: '', count: '' }])
function addPrize() { if (prizes.length < 6) prizes.push({ rank: '', name: '', count: '' }) }
function removePrize(idx) { if (prizes.length > 1) prizes.splice(idx, 1) }
function submit() {
  if (!form.name) { uni.showToast({ title: '请输入名称', icon: 'none' }); return }
  if (!form.total) { uni.showToast({ title: '请输入人数上限', icon: 'none' }); return }
  const validPrizes = prizes.filter(p => p.name.trim())
  if (validPrizes.length === 0) { uni.showToast({ title: '请至少设置一个奖品', icon: 'none' }); return }
  uni.showLoading({ title: '创建中...' })
  setTimeout(() => { uni.hideLoading(); uni.showToast({ title: '创建成功', icon: 'success' }); setTimeout(() => uni.navigateBack(), 1500) }, 1000)
}
</script>

<style lang="scss" scoped
> .create-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 120rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &.small { min-height: 100rpx; } &::placeholder { color: #c3c6d1; } }

.prizes-area { padding: 24rpx; background: #fafbfc; margin-top: 12rpx; border-radius: 14rpx; }
.section-sub { font-size: 24rpx; font-weight: 600; color: #43474f; display: block; margin-bottom: 16rpx; }
.prize-input-row { display: flex; align-items: center; gap: 8rpx; margin-bottom: 12rpx; }
.rank-input { width: 110rpx; height: 60rpx; font-size: 25rpx; background: #fff; border-radius: 10rpx; padding: 0 12rpx; border: none; &::placeholder { color: #c3c6d1; } }
.name-input { flex: 1; height: 60rpx; font-size: 25rpx; background: #fff; border-radius: 10rpx; padding: 0 12rpx; border: none; &::placeholder { color: #c3c6d1; } }
.count-input { width: 90rpx; height: 60rpx; font-size: 25rpx; background: #fff; border-radius: 10rpx; padding: 0 12rpx; border: none; &::placeholder { color: #c3c6d1; } }
.remove-prize { width: 48rpx; text-align: center; line-height: 60rpx; font-size: 32rpx; color: #460002; }
.add-prize-btn { background: transparent; border: 2rpx dashed rgba(195,198,209,0.5); border-radius: 14rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; &::after { display: none; } &:active { background: rgba(195,198,209,0.15); } }
.add-p-text { font-size: 26rpx; color: #43474f; }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>