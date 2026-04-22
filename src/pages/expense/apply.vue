<template>
  <view class="apply-page">
    <custom-nav-bar title="经费申请" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="section-label">
          <text class="label-text">申请信息</text>
        </view>

        <view class="form-card">
          <view class="form-row">
            <text class="row-label block">经费用途</text>
            <textarea class="solid-textarea" v-model="formData.purpose" placeholder="请详细说明经费使用用途..." />
          </view>
          <view class="divider"></view>
          <view class="form-row">
            <text class="row-label block">申请金额</text>
            <view class="amount-input-wrap">
              <text class="amount-prefix">¥</text>
              <input class="amount-input" type="digit" v-model="formData.amount" placeholder="0.00" />
            </view>
          </view>
          <view class="divider"></view>
          <view class="form-row">
            <text class="row-label block">费用明细</text>
            <textarea class="solid-textarea small" v-model="formData.details" placeholder="请列出具体明细（如：物资A 50元，物资B 30元...）" />
          </view>
          <view class="divider"></view>
          <view class="upload-section">
            <text class="row-label block">证明材料</text>
            <view class="upload-grid">
              <view v-for="(f, idx) in formData.proofs" :key="idx" class="proof-item">
                <image :src="f" mode="aspectFill" class="proof-img" />
                <view class="remove-btn" @tap.stop="removeProof(idx)">
                  <text class="remove-x">×</text>
                </view>
              </view>
              <view class="add-proof" @tap="chooseImage">
                <text class="add-icon">+</text>
              </view>
            </view>
          </view>
        </view>

        <view class="flow-card">
          <text class="flow-title">审批流程预览</text>
          <view class="flow-steps">
            <view class="flow-step" v-for="(step, idx) in approvalSteps" :key="idx">
              <view class="step-dot" :class="{ done: idx === 0 }">{{ idx + 1 }}</view>
              <text class="step-text">{{ step }}</text>
              <view class="step-line" v-if="idx < approvalSteps.length - 1"></view>
            </view>
          </view>
        </view>
      </view>

      <view class="bottom-action">
        <button class="primary-btn" @click="onSubmit">
          <text class="btn-text">提交申请</text>
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'

const formData = reactive({
  purpose: '',
  amount: '',
  details: '',
  proofs: []
})

const approvalSteps = [
  '经办人提交',
  '管理员审批',
  '执行拨付'
]

function chooseImage() {
  uni.chooseImage({
    count: 5,
    success: (res) => {
      formData.proofs.push(...res.tempFilePaths)
    }
  })
}

function removeProof(idx) {
  formData.proofs.splice(idx, 1)
}

async function onSubmit() {
  if (!formData.purpose) { uni.showToast({ title: '请填写用途', icon: 'none' }); return }
  if (!formData.amount) { uni.showToast({ title: '请输入金额', icon: 'none' }); return }

  const amount = parseFloat(formData.amount)

  uni.showModal({
    title: '确认提交',
    content: `申请金额：¥${formData.amount}\n审批流程：${approvalSteps.join(' → ')}`,
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '提交中...' })
        try {
          uni.hideLoading()
          uni.showToast({ title: '已提交，等待审批', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1500)
        } catch (error) {
          uni.hideLoading()
          uni.showToast({ title: '网络错误，请重试', icon: 'none' })
        }
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.apply-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: 140rpx;
}

.form-area { padding: 32rpx; }

.section-label { margin-bottom: 20rpx; padding-left: 4rpx; }
.label-text {
  font-size: 22rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 4rpx;
}

.form-card { background: #ffffff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label {
  font-size: 28rpx; font-weight: 500; color: #191c1e;
  &.block { display: block; margin-bottom: 16rpx; }
}
.solid-textarea {
  width: 100%; min-height: 140rpx; font-size: 28rpx; color: #191c1e;
  background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box;
  &.small { min-height: 100rpx; }
  &::placeholder { color: #c3c6d1; }
}
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }

.amount-input-wrap {
  display: flex; align-items: center; gap: 8rpx;
  background: #f7f9fc; border-radius: 12rpx; padding: 16rpx 20rpx;
}
.amount-prefix { font-size: 36rpx; font-weight: 700; color: #001e40; }
.amount-input {
  flex: 1; height: 52rpx; font-size: 40rpx; font-weight: 600; color: #191c1e;
  background: transparent; border: none;
  &::placeholder { color: #c3c6d1; }
}

.upload-section { padding: 28rpx 24rpx; }
.upload-grid {
  display: flex; flex-wrap: wrap; gap: 16rpx;
}
.proof-item {
  position: relative; width: 160rpx; height: 160rpx; border-radius: 14rpx; overflow: hidden;
}
.proof-img { width: 100%; height: 100%; }
.remove-btn {
  position: absolute; top: 6rpx; right: 6rpx; width: 36rpx; height: 36rpx;
  background: rgba(70, 0, 2, 0.8); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.remove-x { color: #fff; font-size: 24rpx; line-height: 1; }
.add-proof {
  width: 160rpx; height: 160rpx; border: 2rpx dashed rgba(195, 198, 209, 0.5);
  border-radius: 14rpx; display: flex; align-items: center; justify-content: center;
}
.add-icon { font-size: 48rpx; color: #c3c6d1; }

.flow-card {
  margin-top: 32rpx; background: linear-gradient(135deg, rgba(0, 30, 64, 0.03), rgba(0, 51, 102, 0.02));
  border-radius: 20rpx; padding: 28rpx 24rpx; border-left: 10rpx solid #001e40;
}
.flow-title {
  font-family: 'PingFang SC', sans-serif; font-size: 26rpx; font-weight: 600;
  color: #191c1e; display: block; margin-bottom: 24rpx;
}
.flow-steps { display: flex; align-items: center; }
.flow-step {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx; flex: 1;
}
.step-dot {
  width: 44rpx; height: 44rpx; border-radius: 50%;
  background: #f2f4f7; display: flex; align-items: center; justify-content: center;
  font-size: 22rpx; font-weight: 700; color: #c3c6d1;
  &.done { background: linear-gradient(135deg, #001e40, #003366); color: #ffffff; }
}
.step-text { font-size: 20rpx; color: #43474f; text-align: center; white-space: nowrap; }
.step-line {
  flex: 1; height: 2rpx; background: #e6e8eb; margin: 0 -12rpx;
  margin-bottom: 30rpx;
}

.bottom-action {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(40rpx); z-index: 100;
}
.primary-btn {
  width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366);
  border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 30, 64, 0.25);
  &:active { transform: scale(0.98); }
}
.btn-text {
  font-family: 'PingFang SC', sans-serif; font-size: 32rpx; font-weight: 700; color: #fff;
}
</style>
