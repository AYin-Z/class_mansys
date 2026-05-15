<template>
  <view class="apply-page">
    <custom-nav-bar title="发起挑战" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <picker mode="selector" :range="typeList" @change="onTypeChange">
            <view class="form-row"><text class="row-label">擂台类型</text><view class="row-value"><text class="value-text">{{ form.type || '请选择' }}</text><text class="arrow">›</text></view></view>
          </picker>
          <view class="form-row"><text class="row-label block">擂台名称</text><input class="solid-input" placeholder="例如：高数擂台" v-model="form.name" /></view>
          <view class="textarea-wrap"><text class="row-label block">擂台描述</text><textarea class="solid-textarea" v-model="form.description" placeholder="描述擂台规则和挑战标准..." /></view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" @click="submit"><text class="btn-text">{{ canCreate ? '创建擂台' : '需要管理员权限' }}</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { createChallenge } from '@/api/challenge'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const canCreate = computed(() => checkIsAdmin(profile.value?.role))

const typeList = ['学习', '纪律作风', '体能']
const form = reactive({ type: '', name: '', description: '' })

function onTypeChange(e) { form.type = typeList[e.detail.value] }

async function submit() {
  if (!canCreate.value) { uni.showToast({ title: '无权创建', icon: 'none' }); return }
  if (!form.type) { uni.showToast({ title: '请选择类型', icon: 'none' }); return }
  if (!form.name) { uni.showToast({ title: '请输入擂台名称', icon: 'none' }); return }
  if (!form.description) { uni.showToast({ title: '请输入描述', icon: 'none' }); return }

  uni.showLoading({ title: '创建中...' })
  try {
    await createChallenge({ name: form.name, type: form.type, description: form.description })
    uni.hideLoading()
    uni.showToast({ title: '已创建', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1200)
  } catch (_) { uni.hideLoading() }
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.apply-page { min-height: 100vh; background-color: #f7f9fc; }
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
