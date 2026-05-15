<template>
  <view class="status-page">
    <custom-nav-bar title="建议详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="detail-card" v-if="detail.id">
        <view class="head-row">
          <text class="cat-tag">{{ detail.category || '其他' }}</text>
          <view :class="['status-badge', statusKey]">{{ statusLabel }}</view>
        </view>
        <text class="detail-content">{{ detail.content }}</text>
        <text class="detail-time">提交于 {{ formatTime(detail.created_at) }}</text>

        <view class="timeline-section">
          <text class="section-label">处理进度</text>
          <view v-for="(step, idx) in steps" :key="idx" class="step-item">
            <view :class="['step-dot', step.done ? 'done' : 'pending']"></view>
            <view class="step-line" v-if="idx < steps.length - 1" :class="{ done: step.done }"></view>
            <view class="step-content">
              <text :class="['step-name', { active: step.done }]">{{ step.name }}</text>
              <text class="step-time">{{ step.time || '待处理' }}</text>
              <text class="step-note" v-if="step.note">{{ step.note }}</text>
            </view>
          </view>
        </view>

        <view class="reply-section" v-if="detail.handler_notes">
          <text class="section-label">处理回复</text>
          <view class="reply-box">
            <text class="reply-text">{{ detail.handler_notes }}</text>
            <text v-if="detail.handler_name" class="reply-by">—— {{ detail.handler_name }}</text>
          </view>
        </view>
      </view>

      <!-- 管理员处理操作 -->
      <view v-if="canHandle && detail.id" class="admin-card">
        <text class="section-label">处理操作</text>
        <view class="status-row">
          <view :class="['status-pill', { active: form.status === 1 }]" @tap="form.status = 1">标记处理中</view>
          <view :class="['status-pill', { active: form.status === 2 }]" @tap="form.status = 2">标记已处理</view>
        </view>
        <textarea
          class="solid-textarea"
          v-model="form.handler_notes"
          placeholder="处理意见（选填，对提交人可见）"
        />
        <button class="primary-btn" @tap="onHandle">提交处理</button>
      </view>

      <view style="height: 80rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getSuggestionDetail, handleSuggestion, SUGGESTION_STATUS_LABEL } from '@/api/suggestion'
import { isAdmin } from '@/utils/auth'

const detail = ref({})
const canHandle = ref(false)
const form = reactive({ status: 1, handler_notes: '' })

const statusKey = computed(() => {
  const s = detail.value.status
  if (s === 0) return 'pending'
  if (s === 1) return 'processing'
  return 'replied'
})

const statusLabel = computed(() => SUGGESTION_STATUS_LABEL[detail.value.status] || '未知')

const steps = computed(() => {
  const s = detail.value.status
  return [
    { name: '提交成功', time: formatTime(detail.value.created_at), done: true },
    { name: '管理员处理中', time: s >= 1 ? formatTime(detail.value.updated_at) : '', done: s >= 1 },
    { name: '已处理', time: s === 2 ? formatTime(detail.value.updated_at) : '', note: detail.value.handler_notes, done: s === 2 }
  ]
})

function formatTime(ts) {
  if (!ts) return ''
  return String(ts).substring(0, 16).replace('T', ' ')
}

async function fetchDetail(id) {
  try {
    const res = await getSuggestionDetail(id)
    if (res?.success) {
      detail.value = res.suggestion || {}
      form.handler_notes = detail.value.handler_notes || ''
      form.status = Math.max(1, Number(detail.value.status || 0))
    }
  } catch (e) {}
}

async function onHandle() {
  uni.showLoading({ title: '提交中...' })
  try {
    await handleSuggestion(detail.value.id, { status: form.status, handler_notes: form.handler_notes })
    uni.hideLoading()
    uni.showToast({ title: '已更新', icon: 'success' })
    fetchDetail(detail.value.id)
  } catch (e) {
    uni.hideLoading()
  }
}

onLoad((opts) => {
  canHandle.value = isAdmin()
  if (opts?.id) fetchDetail(Number(opts.id))
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.status-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.detail-card { margin: 24rpx 32rpx; background: $surface-container-lowest; border-radius: 20rpx; padding: 28rpx 24rpx; }
.head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14rpx; }
.cat-tag { font-size: 22rpx; font-weight: 600; color: $secondary; letter-spacing: 4rpx; text-transform: uppercase; }
.status-badge {
  padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.pending { background: rgba(70,98,112,0.08); color: $secondary; }
  &.processing { background: rgba(0,51,102,0.06); color: $primary-container; }
  &.replied { background: rgba(0,30,64,0.06); color: $primary; }
}
.detail-content { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 500; color: $on-surface; display: block; line-height: 1.6; margin-bottom: 12rpx; }
.detail-time { font-size: 22rpx; color: $outline-variant; display: block; margin-bottom: 22rpx; }

.admin-card { margin: 0 32rpx 32rpx; background: $surface-container-lowest; border-radius: 20rpx; padding: 28rpx 24rpx; }
.status-row { display: flex; gap: 14rpx; margin: 16rpx 0; }
.status-pill { flex: 1; height: 72rpx; border-radius: 14rpx; background: $surface; color: $on-surface-variant; display: flex; align-items: center; justify-content: center; font-size: 26rpx; font-weight: 500; }
.status-pill.active { background: $primary; color: $on-primary; }
.solid-textarea { width: 100%; min-height: 160rpx; font-size: 26rpx; color: $on-surface; background: $surface; border-radius: 12rpx; padding: 18rpx; border: none; box-sizing: border-box; margin-bottom: 16rpx; }
.primary-btn { width: 100%; height: 88rpx; background: $gradient-primary; border-radius: 16rpx; border: none; color: $on-primary; font-size: 28rpx; font-weight: 600; }
.reply-by { display: block; margin-top: 12rpx; font-size: 22rpx; color: $outline-variant; text-align: right; }

.timeline-section { margin-top: 12rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: $on-surface-variant; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 20rpx; }

.step-item { display: flex; gap: 16rpx; &:last-child .step-line { display: none; } }
.step-dot {
  width: 26rpx; height: 26rpx; border-radius: 50%; flex-shrink: 0; margin-top: 4rpx;
  &.done { background: $gradient-primary; }
  &.pending { background: $surface-container-low; border: 2rpx solid #e0e3e6; }
}
.step-line { width: 2rpx; flex: 1; margin-left: 12rpx; background: #e0e3e6; &.done { background: $primary; } }
.step-content { flex: 1; padding-bottom: 24rpx; }
.step-name { font-size: 26rpx; color: $outline-variant; &.active { color: $on-surface; font-weight: 500; } }
.step-time { font-size: 22rpx; color: $outline-variant; display: block; margin-top: 4rpx; }
.step-note { font-size: 23rpx; color: $secondary; margin-top: 4rpx; display: block; }

.reply-section { margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid $surface-container-low; }
.reply-box { background: rgba(70,98,112,0.05); border-radius: 14rpx; padding: 20rpx; border-left: 5rpx solid $secondary; }
.reply-text { font-size: 26rpx; color: $on-surface; line-height: 1.6; }
</style>
