<template>
  <view class="detail-page">
    <custom-nav-bar title="作业详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="info-card">
        <text class="hw-title">{{ hw.title }}</text>
        <view class="info-row"><text class="label">课程</text><text class="value">{{ hw.course }}</text></view>
        <view class="info-row"><text class="label">发布人</text><text class="value">{{ hw.publisher }}</text></view>
        <view class="info-row"><text class="label">截止时间</text><text :class="['value', { urgent: isUrgent }]">{{ hw.deadline }}</text></view>
        <view class="desc-section">
          <text class="section-label">作业要求</text>
          <text class="desc-text">{{ hw.requirement }}</text>
        </view>

        <view v-if="hw.attachments && hw.attachments.length > 0" class="attach-section">
          <text class="section-label">附件</text>
          <view v-for="(f, i) in hw.attachments" :key="i" class="attach-item" @tap="downloadAttach(f)">
            <text class="attach-icon">📎</text><text class="attach-name">{{ f.name }}</text>
            <text class="attach-arrow">›</text>
          </view>
        </view>
      </view>

      <button class="submit-btn" @click="goSubmit">提交作业</button>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
const hw = ref({
  title: '第三章习题', course: '高等数学', publisher: '张老师', deadline: '2026-04-12 23:59',
  requirement: '完成教材P85-P88的1-15题，需写出详细解题过程，拍照上传',
  attachments: [{ name: '第三章习题.pdf' }, { name: '参考答案.pdf' }]
})
const isUrgent = computed(() => {
  const d = new Date(hw.value.deadline).getTime() - Date.now()
  return d > 0 && d < 86400000 * 2
})
function downloadAttach(f) { uni.showToast({ title: `下载：${f.name}`, icon: 'none' }) }
function goSubmit() { uni.showToast({ title: '跳转提交页面', icon: 'none' }) }
</script>

<style lang="scss" scoped
> .detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.info-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.hw-title { font-family: 'PingFang SC'; font-size: 34rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 20rpx; }

.info-row { display: flex; justify-content: space-between; padding: 14rpx 0; border-bottom: 1rpx solid transparent; &:not(:last-of-type) { border-bottom-color: #f2f4f7; } }
.label { font-size: 25rpx; color: #c3c6d1; }
.value { font-size: 25rpx; color: #191c1e; font-weight: 500; &.urgent { color: #460002; } }

.desc-section { margin-top: 22rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 14rpx; }
.desc-text { font-size: 26rpx; color: #191c1e; line-height: 1.6; }

.attach-section { margin-top: 22rpx; }
.attach-item { display: flex; align-items: center; gap: 10rpx; padding: 16rpx 0; &:active { opacity: 0.75; } }
.attach-icon { font-size: 28rpx; }
.attach-name { flex: 1; font-size: 26rpx; color: #001e40; text-decoration: underline; }
.attach-arrow { font-size: 30rpx; color: #c3c6d1; }

.submit-btn { margin: 28rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; font-size: 29rpx; font-weight: 600; color: #fff; &::after { display: none; } }
</style>