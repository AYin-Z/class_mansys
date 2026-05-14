<template>
  <view class="reimbursement-page">
    <custom-nav-bar title="报销申请" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="section-label">
          <text class="label-text">报销信息</text>
        </view>

        <view class="form-card">
          <view class="form-row">
            <text class="row-label block">报销事由</text>
            <textarea class="solid-textarea" v-model="formData.purpose" placeholder="请说明报销事由..." />
          </view>

          <view class="divider"></view>

          <view class="form-row">
            <text class="row-label block">报销金额</text>
            <view class="amount-input-wrap">
              <text class="amount-prefix">¥</text>
              <input class="amount-input" type="digit" v-model="formData.amount" placeholder="0.00" />
            </view>
          </view>

          <view class="form-row">
            <text class="row-label block">明细说明（可选）</text>
            <textarea class="solid-textarea" v-model="formData.details" placeholder="逐项列明开支明细..." style="min-height: 80rpx;" />
          </view>
        </view>

        <!-- My Applications -->
        <view class="history-section" v-if="myApps.length > 0">
          <text class="section-title">我的申请</text>
          <view class="app-list">
            <view v-for="item in myApps" :key="item.id" class="app-card">
              <view :class="['status-dot', statusClass(item.status)]"></view>
              <view class="app-body">
                <text class="app-reason">{{ item.purpose }}</text>
                <text class="app-amount">¥{{ Number(item.amount).toFixed(2) }}</text>
                <view :class="['status-tag', statusClass(item.status)]">{{ statusText(item.status) }}</view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="bottom-action">
        <button class="primary-btn" :disabled="submitting" @tap="onSubmit">
          <text class="btn-text">{{ submitting ? '提交中...' : '提交报销申请' }}</text>
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { createExpense, getMyExpenses } from '@/api/fee'

const submitting = ref(false)
const myApps = ref([])
const formData = reactive({
  purpose: '',
  amount: '',
  details: ''
})

function statusClass(s) {
  if (s === 0 || s === 'pending') return 'pending'
  if (s === 1 || s === 'approved') return 'approved'
  return 'rejected'
}
function statusText(s) {
  if (s === 0) return '审批中'
  if (s === 1) return '已通过'
  return '已驳回'
}

async function onSubmit() {
  if (!formData.purpose) { uni.showToast({ title: '请填写事由', icon: 'none' }); return }
  if (!formData.amount) { uni.showToast({ title: '请输入金额', icon: 'none' }); return }

  submitting.value = true
  try {
    const res = await createExpense({
      amount: parseFloat(formData.amount),
      purpose: formData.purpose,
      details: formData.details ? formData.details.split('\n').filter(Boolean) : undefined
    })
    if (res.success) {
      uni.showToast({ title: '已提交，等待审批', icon: 'success' })
      formData.purpose = ''
      formData.amount = ''
      formData.details = ''
      await loadMyApps()
      setTimeout(() => uni.navigateBack(), 1500)
    }
  } catch (err) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function loadMyApps() {
  try {
    const res = await getMyExpenses()
    if (res.success) myApps.value = res.expenses
  } catch (_) {}
}

onMounted(loadMyApps)
</script>

<style lang="scss" scoped>
.reimbursement-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }
.form-area { padding: 32rpx; }
.section-label { margin-bottom: 20rpx; padding-left: 4rpx; }
.label-text { font-size: 22rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 4rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-textarea { width: 100%; min-height: 120rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.amount-input-wrap { display: flex; align-items: center; gap: 8rpx; background: #f7f9fc; border-radius: 12rpx; padding: 16rpx 20rpx; }
.amount-prefix { font-size: 36rpx; font-weight: 700; color: #001e40; }
.amount-input { flex: 1; height: 52rpx; font-size: 40rpx; font-weight: 600; color: #191c1e; background: transparent; border: none; &::placeholder { color: #c3c6d1; } }
.history-section { margin-top: 40rpx; }
.section-title { font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 20rpx; }
.app-list { display: flex; flex-direction: column; gap: 12rpx; }
.app-card { position: relative; display: flex; align-items: center; background: #fff; border-radius: 16rpx; overflow: hidden; }
.status-dot { width: 8rpx; height: 80rpx; flex-shrink: 0; &.pending { background: #466270; } &.approved { background: #003366; } &.rejected { background: #460002; } }
.app-body { flex: 1; padding: 20rpx; display: flex; align-items: center; gap: 16rpx; }
.app-reason { flex: 1; font-size: 26rpx; color: #191c1e; font-weight: 500; }
.app-amount { font-family: 'PingFang SC'; font-size: 27rpx; font-weight: 700; color: #001e40; }
.status-tag { padding: 6rpx 16rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600; &.pending { background: rgba(70,98,112,0.08); color: #466270; } &.approved { background: rgba(0,30,64,0.06); color: #001e40; } &.rejected { background: rgba(70,0,2,0.06); color: #460002; } }
.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
