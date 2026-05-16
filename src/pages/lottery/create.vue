<template>
  <div class="create-page">
    <custom-nav-bar title="创建抽奖" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="form-area">
        <div class="form-card">
          <div class="form-row"><span class="row-label block">活动名称</span><input class="solid-input" placeholder="请输入活动名称" v-model="form.name" /></div>
          <div class="textarea-wrap"><span class="row-label block">活动简介</span><textarea class="solid-textarea small" v-model="form.description" placeholder="选填" /></div>
          <div class="textarea-wrap"><span class="row-label block">活动规则</span><textarea class="solid-textarea" v-model="form.rules" placeholder="奖品、参与方式、开奖时间等" /></div>
          <div class="form-row">
            <span class="row-label block">开始日期</span>
            <picker mode="date" :value="form.startDate" @change="(e) => form.startDate = e.detail.value">
              <div class="solid-input picker-display">{{ form.startDate || '请选择' }}</div>
            </picker>
          </div>
          <div class="form-row">
            <span class="row-label block">结束日期</span>
            <picker mode="date" :value="form.endDate" @change="(e) => form.endDate = e.detail.value">
              <div class="solid-input picker-display">{{ form.endDate || '请选择' }}</div>
            </picker>
          </div>
        </div>
      </div>
      <div class="bottom-action"><button class="primary-btn" @click="submit"><span class="btn-text">创建抽奖</span></button></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { createLottery } from '@/api/lottery'
import { showToast } from '@/utils/ui'
const form = reactive({ name: '', description: '', rules: '', startDate: '', endDate: '' })

async function submit() {
  if (!form.name) { showToast('请输入名称'); return }
  if (!form.rules) { showToast('请输入规则'); return }
  if (!form.startDate || !form.endDate) { showToast('请选择起止日期'); return }

  showToast('创建中...')
  try {
    await createLottery({
      name: form.name,
      description: form.description,
      rules: form.rules,
      start_time: `${form.startDate} 00:00:00`,
      end_time: `${form.endDate} 23:59:59`
    })
    
    showToast('创建成功')
    setTimeout(() => router.back(), 1200)
  } catch (_) {  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.create-page { min-height: 100vh; background-color: #f7f9fc; }
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
