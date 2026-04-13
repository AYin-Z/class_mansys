<template>
  <view class="apply-page">
    <custom-nav-bar title="申请请假" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="section-label">
          <text class="label-text">请假信息</text>
        </view>

        <view class="form-card">
          <picker mode="selector" :range="leaveTypes" @change="onTypeChange" :value="typeIndex">
            <view class="form-row">
              <text class="row-label">请假类型</text>
              <view class="row-value">
                <text :class="['value-text', { placeholder: !formData.type }]">{{ formData.type || '请选择' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>

          <view class="divider"></view>

          <picker mode="selector" :range="reasonTypes" @change="onReasonChange" :value="reasonIndex">
            <view class="form-row">
              <text class="row-label">请假事由</text>
              <view class="row-value">
                <text :class="['value-text', { placeholder: !formData.reasonType }]">{{ formData.reasonType || '请选择' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>

          <view class="divider"></view>

          <view class="form-row" @tap="showStartDate = true">
            <text class="row-label">开始时间</text>
            <view class="row-value">
              <text :class="['value-text', { placeholder: !formData.startDate }]">{{ formData.startDate || '请选择' }}</text>
              <text class="arrow">›</text>
            </view>
          </view>

          <view class="divider"></view>

          <view class="form-row" @tap="showEndDate = true">
            <text class="row-label">结束时间</text>
            <view class="row-value">
              <text :class="['value-text', { placeholder: !formData.endDate }]">{{ formData.endDate || '请选择' }}</text>
              <text class="arrow">›</text>
            </view>
          </view>

          <view class="divider"></view>

          <view class="textarea-wrap">
            <text class="row-label block">详细说明</text>
            <textarea class="ghost-textarea" v-model="formData.detail" placeholder="请输入详细说明（选填）" />
          </view>
        </view>
      </view>

      <view class="bottom-action">
        <button class="primary-btn" @click="onSubmit">
          <text class="btn-text">提交申请</text>
        </button>
      </view>
    </scroll-view>

    <uni-datetime-picker type="date" v-model="formData.startDate" :visible="showStartDate" @close="showStartDate = false" @confirm="showStartDate = false" />
    <uni-datetime-picker type="date" v-model="formData.endDate" :visible="showEndDate" @close="showEndDate = false" @confirm="showEndDate = false" />
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'

const leaveTypes = ['早操', '早集合', '午集合', '晚自习', '其他']
const reasonTypes = ['事假', '病假', '上课', '公假', '其他']

const typeIndex = ref(0)
const reasonIndex = ref(0)
const showStartDate = ref(false)
const showEndDate = ref(false)

const formData = reactive({
  type: '',
  reasonType: '',
  startDate: '',
  endDate: '',
  detail: ''
})

function onTypeChange(e) {
  formData.type = leaveTypes[e.detail.value]
}

function onReasonChange(e) {
  formData.reasonType = reasonTypes[e.detail.value]
}

function onSubmit() {
  if (!formData.type) {
    uni.showToast({ title: '请选择请假类型', icon: 'none' })
    return
  }
  if (!formData.reasonType) {
    uni.showToast({ title: '请选择请假事由', icon: 'none' })
    return
  }
  if (!formData.startDate) {
    uni.showToast({ title: '请选择开始时间', icon: 'none' })
    return
  }
  if (!formData.endDate) {
    uni.showToast({ title: '请选择结束时间', icon: 'none' })
    return
  }

  uni.showLoading({ title: '提交中...' })
  setTimeout(() => {
    uni.hideLoading()
    uni.showToast({ title: '申请已提交', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }, 1000)
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

.form-area {
  padding: 32rpx;
}

.section-label {
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.label-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #43474f;
  text-transform: uppercase;
  letter-spacing: 4rpx;
}

.form-card {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;

  &:active {
    background: #fafbfc;
  }
}

.row-label {
  font-size: 28rpx;
  font-weight: 500;
  color: #191c1e;

  &.block {
    display: block;
    margin-bottom: 16rpx;
  }
}

.row-value {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.value-text {
  font-size: 28rpx;
  color: #191c1e;

  &.placeholder {
    color: #c3c6d1;
  }
}

.arrow {
  font-size: 36rpx;
  color: #c3c6d1;
}

.divider {
  height: 1rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
  background: transparent;
}

.textarea-wrap {
  padding: 28rpx 24rpx;
}

.ghost-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #191c1e;
  border: none;
  border-bottom: 2rpx solid rgba(195,198,209,0.2);
  background: transparent;
  padding: 0;

  &::placeholder {
    color: #c3c6d1;
  }

  &:focus {
    border-bottom-color: #001e40;
  }
}

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
  z-index: 100;
}

.primary-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
  border-radius: 20rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25);

  &:active {
    transform: scale(0.98);
  }
}

.btn-text {
  font-family: 'PingFang SC', sans-serif;
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>