<template>
  <div class="apply-page">
    <custom-nav-bar title="申请心理干预" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="privacy-notice">
        <span class="notice-icon">🔒</span>
        <span class="notice-text">您的申请将匿名提交，仅心理副区和辅导员可见</span>
      </div>

      <div class="form-area">
        <div class="form-card">
          <picker mode="selector" :range="types" @change="onTypeChange"><div class="form-row"><span class="row-label">干预类型</span><div class="row-value"><span class="value-text">{{ form.type || '请选择' }}</span><span class="arrow">›</span></div></div></picker>
          <div class="divider"></div>
          <div class="textarea-wrap"><span class="row-label block">详细描述</span><textarea class="solid-textarea" v-model="form.detail" placeholder="请详细描述您的情况和需求..." /></div>
        </div>
      </div>

      <div class="bottom-action"><button class="primary-btn" @click="submit"><span class="btn-text">匿名提交</span></button></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { submitPsychApplication } from '@/api/psychological'
import { showToast } from '@/utils/ui'
const types = ['情绪疏导', '学业压力', '人际关系', '睡眠问题', '其他']
const form = reactive({ type: '', detail: '' })

function onTypeChange(e) { form.type = types[e.detail.value] }

async function submit() {
  if (!form.type) { showToast('请选择类型'); return }
  if (!form.detail) { showToast('请填写详情'); return }
  showToast('提交中...')
  try {
    const content = `[${form.type}] ${form.detail}`
    const res = await submitPsychApplication(content)
    
    if (res?.success) {
      showToast('已提交，请放心')
      setTimeout(() => router.back(), 1500)
    }
  } catch (_) {
    
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.apply-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.privacy-notice {
  display: flex; align-items: center; gap: 12rpx; margin: 24rpx 32rpx;
  padding: 20rpx 24rpx; background: rgba(0,51,102,0.04); border-radius: 14rpx; border-left: 6rpx solid #003366;
}
.notice-icon { font-size: 28rpx; }
.notice-text { font-size: 24rpx; color: #43474f; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 24rpx; &:active { background: #fafbfc; } }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.row-value { display: flex; align-items: center; gap: 8rpx; }
.value-text { font-size: 28rpx; color: #191c1e; }
.arrow { font-size: 36rpx; color: #c3c6d1; }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 240rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
