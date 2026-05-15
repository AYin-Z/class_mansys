<template>
  <div class="apply-page">
    <custom-nav-bar title="使用申请" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="form-area">
        <div class="section-label">
          <span class="label-text">申请信息</span>
        </div>

        <div class="form-card">
          <div class="form-row">
            <span class="row-label block">用途说明</span>
            <textarea class="solid-textarea" v-model="formData.purpose" placeholder="请详细说明班费使用用途..." />
          </div>
          <div class="divider"></div>
          <div class="form-row">
            <span class="row-label block">申请金额</span>
            <div class="amount-input-wrap">
              <span class="amount-prefix">¥</span>
              <input class="amount-input" type="digit" v-model="formData.amount" placeholder="0.00" />
            </div>
          </div>
          <div class="divider"></div>
          <div class="form-row">
            <span class="row-label block">金额明细</span>
            <textarea class="solid-textarea small" v-model="formData.details" placeholder="请列出具体明细（如：物资A 50元，物资B 30元...）" />
          </div>
          <div class="divider"></div>
          <div class="upload-section">
            <span class="row-label block">证明材料</span>
            <div class="upload-grid">
              <div v-for="(f, idx) in formData.proofs" :key="idx" class="proof-item">
                <img :src="f" mode="aspectFill" class="proof-img" />
                <div class="remove-btn" @tap.stop="removeProof(idx)">
                  <span class="remove-x">×</span>
                </div>
              </div>
              <div class="add-proof" @tap="chooseImage">
                <span class="add-icon">+</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Approval Flow Preview -->
        <div class="flow-card">
          <span class="flow-title">审批流程预览</span>
          <div class="flow-steps">
            <div class="flow-step" v-for="(step, idx) in approvalSteps" :key="idx">
              <div class="step-dot" :class="{ done: idx === 0 }">{{ idx + 1 }}</div>
              <span class="step-text">{{ step }}</span>
              <div class="step-line" v-if="idx < approvalSteps.length - 1"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-action">
        <button class="primary-btn" @click="onSubmit">
          <span class="btn-text">提交申请</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { createExpense } from '@/api/fee'
import { getToken } from '@/utils/request'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')

const formData = reactive({
  purpose: '',
  amount: '',
  details: '',
  proofs: []
})

const approvalSteps = [
  '经办人提交',
  '区队长初审',
  '班干部投票(≥2/3)',
  '执行报销'
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

/** 上传单个证明材料，返回 URL */
function uploadProofFile(filePath) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    uni.uploadFile({
      url: `${API_BASE_URL}/api/fee/proof/upload`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.success) resolve(data.url)
          else reject(new Error(data.error || '上传失败'))
        } catch (e) {
          reject(new Error('解析响应失败'))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      }
    })
  })
}

async function onSubmit() {
  if (!formData.purpose) { showToast('请填写用途'); return }
  if (!formData.amount) { showToast('请输入金额'); return }

  const amount = parseFloat(formData.amount)
  if (isNaN(amount) || amount <= 0) { showToast('请输入有效金额'); return }
  if (amount > 100000) { showToast('单笔申请不超过¥100,000'); return }
  let steps = [...approvalSteps]
  if (amount < 100) {
    steps = ['经办人提交', '区队长审核', '执行']
  } else if (amount > 500) {
    steps = ['经办人提交', '区队长初审', '辅导员复核', '班干部投票', '执行报销']
  }

  uni.showModal({
    title: '确认提交',
    content: `申请金额：¥${formData.amount}\n审批流程：${steps.join(' → ')}`,
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '提交中...' })
        try {
          // 上传证明材料（如果有）
          let proof_url = ''
          if (formData.proofs.length > 0) {
            uni.showLoading({ title: '上传图片中...' })
            const uploadedUrls = []
            for (const fp of formData.proofs) {
              const url = await uploadProofFile(fp)
              uploadedUrls.push(url)
            }
            proof_url = uploadedUrls.join(',')
            uni.showLoading({ title: '提交中...' })
          }

          const res = await createExpense({
            type: '支出',
            amount: amount,
            purpose: formData.purpose + (formData.details ? `\n明细：${formData.details}` : ''),
            proof_url: proof_url || undefined
          })
          
          if (res.success) {
            showToast('已提交，等待审核')
            setTimeout(() => router.back(), 1500)
          } else {
            uni.showToast({ title: res.message || '提交失败', icon: 'none' })
          }
        } catch (error) {
          
          showToast('网络错误，请重试')
        }
      }
    }
  })
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.apply-page {
  min-height: 100vh;
  background-color: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: 140rpx;
}

.form-area { padding: 32rpx; }

.section-label { margin-bottom: 20rpx; padding-left: 4rpx; }
.label-text {
  font-size: 22rpx; font-weight: 600; color: $on-surface-variant; text-transform: uppercase; letter-spacing: 4rpx;
}

.form-card { background: $surface-container-lowest; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label {
  font-size: 28rpx; font-weight: 500; color: $on-surface;
  &.block { display: block; margin-bottom: 16rpx; }
}
.solid-textarea {
  width: 100%; min-height: 140rpx; font-size: 28rpx; color: $on-surface;
  background: $surface; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box;
  &.small { min-height: 100rpx; }
  &::placeholder { color: $outline-variant; }
}
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }

.amount-input-wrap {
  display: flex; align-items: center; gap: 8rpx;
  background: $surface; border-radius: 12rpx; padding: 16rpx 20rpx;
}
.amount-prefix { font-size: 36rpx; font-weight: 700; color: $primary; }
.amount-input {
  flex: 1; height: 52rpx; font-size: 40rpx; font-weight: 600; color: $on-surface;
  background: transparent; border: none;
  &::placeholder { color: $outline-variant; }
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
  background: rgba(70,0,2,0.8); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.remove-x { color: $on-primary; font-size: 24rpx; line-height: 1; }
.add-proof {
  width: 160rpx; height: 160rpx; border: 2rpx dashed rgba(195,198,209,0.5);
  border-radius: 14rpx; display: flex; align-items: center; justify-content: center;
}
.add-icon { font-size: 48rpx; color: $outline-variant; }

.flow-card {
  margin-top: 32rpx; background: $gradient-glass;
  border-radius: 20rpx; padding: 28rpx 24rpx; border-left: 10rpx solid $primary;
}
.flow-title {
  font-family: 'PingFang SC', sans-serif; font-size: 26rpx; font-weight: 600;
  color: $on-surface; display: block; margin-bottom: 24rpx;
}
.flow-steps { display: flex; align-items: center; }
.flow-step {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx; flex: 1;
}
.step-dot {
  width: 44rpx; height: 44rpx; border-radius: 50%;
  background: $surface-container-low; display: flex; align-items: center; justify-content: center;
  font-size: 22rpx; font-weight: 700; color: $outline-variant;
  &.done { background: $gradient-primary; color: $on-primary; }
}
.step-text { font-size: 20rpx; color: $on-surface-variant; text-align: center; white-space: nowrap; }
.step-line {
  flex: 1; height: 2rpx; background: $surface-container-high; margin: 0 -12rpx;
  margin-bottom: 30rpx;
}

.bottom-action {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100;
}
.primary-btn {
  width: 100%; height: 96rpx; background: $gradient-primary;
  border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25);
  &:active { transform: scale(0.98); }
}
.btn-text {
  font-family: 'PingFang SC', sans-serif; font-size: 32rpx; font-weight: 700; color: $on-primary;
}
</style>