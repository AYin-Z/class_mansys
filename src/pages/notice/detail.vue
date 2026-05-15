<template>
  <view class="detail-page">
    <custom-nav-bar title="通知详情" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <!-- Header -->
      <view class="detail-header">
        <view :class="['priority-banner', priorityClass(notice.priority)]">
          <text class="priority-text">{{ priorityLabel(notice.priority) }}</text>
        </view>
        <text class="detail-title">{{ notice.title }}</text>
        <view class="meta-row">
          <text class="meta-item">{{ notice.author }}</text>
          <text class="meta-dot">·</text>
          <text class="meta-item">{{ notice.time }}</text>
        </view>
      </view>

      <!-- Content -->
      <view class="content-card">
        <div v-html="notice.content"></div>
      </view>

      <!-- Attachments -->
      <view class="section-block" v-if="notice.attachments && notice.attachments.length > 0">
        <text class="block-title">附件</text>
        <view class="attachment-list">
          <view v-for="(file, idx) in notice.attachments" :key="idx" class="attachment-item" @tap="downloadFile(file)">
            <text class="file-icon">📎</text>
            <text class="file-name">{{ file.name }}</text>
            <text class="file-size">{{ file.size }}</text>
          </view>
        </view>
      </view>

      <view v-if="canDelete && notice.id" class="action-row" style="display:flex;gap:12px;">
        <view class="btn-edit" @tap="onEdit">编辑通知</view>
        <view class="btn-danger" @tap="onDelete">删除该通知</view>
      </view>

      <view style="height: 80rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getNoticeDetail, deleteNotice } from '@/api/notice'
import { canPublishNotice } from '@/utils/auth.js'

const notice = ref({
  id: null,
  title: '加载中…',
  priority: 0,
  type: '',
  author: '',
  time: '',
  content: '',
  attachments: []
})
const noticeId = ref(null)
const canDelete = ref(false)

onLoad((opts) => {
  noticeId.value = Number(opts?.id)
  canDelete.value = canPublishNotice()
  if (noticeId.value) fetchDetail()
})

function formatTime(ts) {
  if (!ts) return ''
  return String(ts).substring(0, 16).replace('T', ' ')
}

function renderContent(text) {
  if (!text) return ''
  // 简单把换行渲染成 <br>，并裹一层段落样式
  const safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
  return `<p style="font-size:calc(28 * 100vw / 750);color:#43474f;line-height:1.8;">${safe}</p>`
}

async function fetchDetail() {
  try {
    const res = await getNoticeDetail(noticeId.value)
    if (res?.success && res.notice) {
      const n = res.notice
      notice.value = {
        id: n.id,
        title: n.title,
        priority: Number(n.priority || 0),
        type: n.type || '',
        author: n.creator_name || n.creator_nickname || '管理员',
        time: formatTime(n.created_at),
        content: renderContent(n.content),
        attachments: []
      }
    }
  } catch (e) {
    console.error('获取通知详情失败:', e)
  }
}

function priorityClass(p) {
  if (p === 2) return 'urgent'
  if (p === 1) return 'important'
  return 'daily'
}

function priorityLabel(p) {
  if (p === 2) return '紧急'
  if (p === 1) return '重要'
  return '日常'
}

function downloadFile(file) {
  uni.showToast({ title: `下载：${file.name}`, icon: 'none' })
}

function onEdit() {
  uni.navigateTo({ url: `/pages/notice/publish?id=${noticeId.value}` })
}

function onDelete() {
  if (!noticeId.value) return
  uni.showModal({
    title: '删除通知',
    content: '确定删除该通知？此操作不可撤销。',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await deleteNotice(noticeId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch (e) {
        // request 已 toast
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.detail-header {
  padding: 32rpx;
}

.priority-banner {
  display: inline-flex;
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
  margin-bottom: 20rpx;

  &.urgent { background: rgba(70,0,2,0.08); }
  &.important { background: rgba(0,30,64,0.06); }
  &.daily { background: rgba(70,98,112,0.08); }
}

.priority-text {
  font-size: 22rpx;
  font-weight: 600;

  .urgent & { color: #460002; }
  .important & { color: #001e40; }
  .daily & { color: #466270; }
}

.detail-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 36rpx;
  font-weight: 700;
  color: #191c1e;
  line-height: 1.4;
  display: block;
  margin-bottom: 16rpx;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #c3c6d1;
}

.meta-dot {
  font-size: 24rpx;
  color: #c3c6d1;
}

.content-card {
  margin: 0 32rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
}

.section-block {
  margin: 32rpx 32rpx 0;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
}

.block-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 26rpx;
  font-weight: 600;
  color: #191c1e;
  display: block;
  margin-bottom: 20rpx;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 20rpx;
  background: #f2f4f7;
  border-radius: 14rpx;

  &:active {
    opacity: 0.75;
  }
}

.file-icon {
  font-size: 32rpx;
}

.file-name {
  flex: 1;
  font-size: 26rpx;
  color: #191c1e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 22rpx;
  color: #c3c6d1;
  flex-shrink: 0;
}

.action-row {
  padding: 32rpx;
}

.btn-edit {
  flex: 1;
  height: 88rpx;
  border-radius: 14rpx;
  background: #001e40;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  &:active { opacity: 0.85; }
}

.btn-danger {
  height: 88rpx;
  border-radius: 14rpx;
  background: #460002;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    opacity: 0.85;
  }
}
</style>