<template>
  <div class="detail-page">
    <custom-nav-bar title="通知详情" :showBack="true" />

    <div scroll-y class="main-scroll">
      <!-- Header -->
      <div class="detail-header">
        <div :class="['priority-banner', priorityClass(notice.priority)]">
          <span class="priority-text">{{ priorityLabel(notice.priority) }}</span>
        </div>
        <span class="detail-title">{{ notice.title }}</span>
        <div class="meta-row">
          <span class="meta-item">{{ notice.author }}</span>
          <span class="meta-dot">·</span>
          <span class="meta-item">{{ notice.time }}</span>
        </div>
      </div>

      <!-- Content -->
      <div class="content-card">
        <!-- Todo Banner -->
        <div v-if="notice.is_todo" :class="['todo-banner', { completed: notice.is_completed }]">
          <span class="todo-icon">{{ notice.is_completed ? '✅' : '📋' }}</span>
          <span class="todo-text">{{ notice.is_completed ? '已完成' : '待完成' }}</span>
          <div v-if="!notice.is_completed && !notice.is_loading" class="todo-btn" @tap="onComplete">
            <span class="todo-btn-text">标记已完成</span>
          </div>
          <span v-if="notice.is_loading" class="todo-loading">处理中…</span>
        </div>
        <div v-html="notice.content"></div>
      </div>

      <!-- Attachments -->
      <div class="section-block" v-if="notice.attachments && notice.attachments.length > 0">
        <span class="block-title">附件</span>
        <div class="attachment-list">
          <div v-for="(file, idx) in notice.attachments" :key="idx" class="attachment-item" @tap="downloadFile(file)">
            <span class="file-icon">📎</span>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
          </div>
        </div>
      </div>

      <div v-if="canDelete && notice.id" class="action-row" style="display:flex;gap:12px;">
        <div class="btn-edit" @tap="onEdit">编辑通知</div>
        <div class="btn-danger" @tap="onDelete">删除该通知</div>
      </div>

      <div style="height: 80rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getNoticeDetail, deleteNotice, completeTodo } from '@/api/notice'
import { canPublishNotice } from '@/utils/auth'
const notice = ref({
  id: null,
  title: '加载中…',
  priority: 0,
  type: '',
  author: '',
  time: '',
  content: '',
  attachments: [],
  is_todo: false,
  is_completed: false,
  is_loading: false
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
        attachments: n.attachments || [],
        is_todo: !!n.is_todo,
        is_completed: !!n.is_completed,
        is_loading: false
      }
      // 解析 JSON 字符串附件
      if (typeof notice.value.attachments === 'string') {
        try { notice.value.attachments = JSON.parse(notice.value.attachments) }
        catch { notice.value.attachments = [] }
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

function formatFileSize(bytes) {
  const n = Number(bytes || 0)
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + 'KB'
  return n + 'B'
}

function downloadFile(file) {
  if (file.url) {
    window.open(file.url, '_blank')
  } else {
    uni.showToast({ title: `附件：${file.name}`, icon: 'none' })
  }
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
        showToast('已删除')
        setTimeout(() => router.back(), 600)
      } catch (e) {
        // request 已 toast
      }
    }
  })
}

async function onComplete() {
  try {
    notice.value.is_loading = true
    await completeTodo(noticeId.value)
    notice.value.is_completed = true
    notice.value.is_loading = false
    showToast('已标记完成')
  } catch (e) {
    notice.value.is_loading = false
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.detail-page {
  min-height: 100vh;
  background-color: $surface;
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

  .urgent & { color: $tertiary; }
  .important & { color: $primary; }.daily & { color: $secondary; }
}

.detail-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 36rpx;
  font-weight: 700;
  color: $on-surface;
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
  color: $outline-variant;
}

.meta-dot {
  font-size: 24rpx;
  color: $outline-variant;
}

.content-card {
  margin: 0 32rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
}

.todo-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 28rpx;
  margin: -32rpx -32rpx 32rpx;
  border-radius: 20rpx 20rpx 0 0;
  background: linear-gradient(135deg, rgba(70,98,112,0.08), rgba(195,198,209,0.12));
  &.completed { background: linear-gradient(135deg, rgba(52,168,83,0.08), rgba(52,168,83,0.04)); }
}
.todo-icon { font-size: 32rpx; }
.todo-text { flex: 1; font-size: 26rpx; font-weight: 600; color: #43474f; .completed & { color: #1f7a3b; } }
.todo-btn {
  padding: 8rpx 24rpx; border-radius: 999rpx; background: #001e40;
  &:active { opacity: 0.85; }
}
.todo-btn-text { font-size: 24rpx; font-weight: 600; color: #fff; }
.todo-loading { font-size: 24rpx; color: #8c909a; }

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
  color: $on-surface;
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
  background: $surface-container-low;
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
  color: $on-surface;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 22rpx;
  color: $outline-variant;
  flex-shrink: 0;
}

.action-row {
  padding: 32rpx;
}

.btn-edit {
  flex: 1;
  height: 88rpx;
  border-radius: 14rpx;
  background: $primary;
  color: $on-primary;
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
  background: $tertiary;
  color: $on-primary;
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