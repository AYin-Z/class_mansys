<template>
  <div class="publish-page">
    <custom-nav-bar title="发布公告" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="form-area">
        <div class="form-card">
          <div class="form-row"><span class="row-label block">公告标题</span><input class="solid-input" placeholder="请输入标题" v-model="title" /></div>
          <div class="divider"></div>
          <div class="textarea-wrap"><span class="row-label block">公告内容</span><textarea class="solid-textarea" v-model="content" placeholder="请输入公告内容..." /></div>
        </div>
      </div>
      <div class="bottom-action"><button class="primary-btn" @click="submit"><span class="btn-text">发布</span></button></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createAnnouncement } from '@/api/announcement'
const title = ref('')
const content = ref('')

async function submit() {
  if (!title.value.trim()) { showToast('请输入标题'); return }
  if (!content.value.trim()) { showToast('请输入内容'); return }
  uni.showLoading({ title: '发布中...' })
  try {
    await createAnnouncement({ title: title.value.trim(), content: content.value.trim() })
    
    showToast('发布成功')
    setTimeout(() => router.back(), 1000)
  } catch (e) {
    
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.publish-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }
.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; &::placeholder { color: #c3c6d1; } }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 280rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
