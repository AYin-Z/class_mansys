<template>
  <div class="create-page">
    <custom-nav-bar title="创建相册" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="form-area">
        <div class="form-card">
          <div class="form-row"><span class="row-label block">相册名称</span><input class="solid-input" placeholder="请输入相册名称" v-model="name" /></div>
          <div class="divider"></div>
          <div class="form-row"><span class="row-label block">相册描述</span><textarea class="solid-textarea small" placeholder="描述这个相册（选填）" v-model="desc" /></div>
        </div>
      </div>
      <div class="bottom-action"><button class="primary-btn" @click="submit"><span class="btn-text">创建相册</span></button></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createAlbum } from '@/api/album'
import { showToast } from '@/utils/ui'
const name = ref('')
const desc = ref('')

async function submit() {
  if (!name.value.trim()) { showToast('请输入名称'); return }
  showToast('创建中...')
  try {
    await createAlbum({ name: name.value.trim(), description: desc.value.trim() })
    
    showToast('创建成功')
    setTimeout(() => router.back(), 800)
  } catch (e) {
    
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.create-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }
.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; &::placeholder { color: #c3c6d1; } }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.solid-textarea { width: 100%; min-height: 120rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &.small { min-height: 100rpx; } &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
