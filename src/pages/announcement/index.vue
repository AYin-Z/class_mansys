<template>
  <view class="announcement-page">
    <custom-nav-bar title="公告资源" />
    <scroll-view scroll-y class="main-scroll">
      <view class="tab-row">
        <view :class="['tab-item', { active: currentTab === 'notice' }]" @tap="currentTab = 'notice'">
          <text class="tab-text">公告</text>
        </view>
        <view :class="['tab-item', { active: currentTab === 'resource' }]" @tap="currentTab = 'resource'">
          <text class="tab-text">资源共享</text>
        </view>
      </view>

      <!-- Notice Tab -->
      <view v-if="currentTab === 'notice'" class="content-list">
        <view v-for="item in notices" :key="item.id" class="list-card" @tap="goDetail(item)">
          <view class="card-accent"></view>
          <view class="card-body">
            <text class="card-title">{{ item.title }}</text>
            <text class="card-summary">{{ item.summary }}</text>
            <view class="card-meta">
              <text class="meta-time">{{ item.time }}</text>
              <text class="meta-author">{{ item.author }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Resource Tab -->
      <view v-else class="resource-grid">
        <view v-for="item in resources" :key="item.id" class="resource-card" @tap="downloadResource(item)">
          <view :class="['file-icon', item.type]">
            <text class="icon-text">{{ fileIcon(item.type) }}</text>
          </view>
          <view class="file-info">
            <text class="file-name">{{ item.name }}</text>
            <text class="file-size">{{ item.size }} · {{ item.uploader }}</text>
          </view>
          <text class="download-icon">↓</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>

    <view v-if="canPublish" class="fab-btn" @tap="onFabTap">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAnnouncements, getResources, deleteAnnouncement, deleteResource } from '@/api/announcement'
import { canPublishNotice, isAdmin } from '@/utils/auth.js'

const currentTab = ref('notice')
const notices = ref([])
const resources = ref([])
const canPublish = ref(false)

function fileIcon(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('pdf')) return 'PDF'
  if (t.includes('xls') || t.includes('excel')) return 'XLS'
  if (t.includes('doc') || t.includes('word')) return 'DOC'
  if (t.includes('image') || t.includes('png') || t.includes('jpg')) return 'IMG'
  return 'FILE'
}

function fileTypeClass(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('pdf')) return 'pdf'
  if (t.includes('xls') || t.includes('excel')) return 'excel'
  if (t.includes('doc') || t.includes('word')) return 'word'
  if (t.includes('image') || t.includes('png') || t.includes('jpg')) return 'image'
  return 'word'
}

function formatSize(bytes) {
  const n = Number(bytes || 0)
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + 'KB'
  return n + 'B'
}

function formatTime(ts) {
  if (!ts) return ''
  return String(ts).substring(0, 10).replace('T', ' ')
}

async function fetchNotices() {
  try {
    const res = await getAnnouncements()
    if (res?.success) {
      notices.value = (res.announcements || []).map(a => ({
        id: a.id,
        title: a.title,
        summary: (a.content || '').substring(0, 60),
        time: formatTime(a.created_at),
        author: a.creator_name || '管理员',
        raw: a
      }))
    }
  } catch (e) { /* request 已 toast */ }
}

async function fetchResources() {
  try {
    const res = await getResources()
    if (res?.success) {
      resources.value = (res.resources || []).map(r => ({
        id: r.id,
        name: r.name,
        type: fileTypeClass(r.type),
        size: formatSize(r.size),
        uploader: r.uploader_name || '管理员',
        url: r.url
      }))
    }
  } catch (e) { /* request 已 toast */ }
}

function goDetail(item) {
  uni.showModal({
    title: item.title,
    content: item.raw?.content || item.summary,
    showCancel: canPublish.value,
    cancelText: '删除',
    confirmText: '关闭',
    success: async (r) => {
      if (r.cancel && canPublish.value) {
        try {
          await deleteAnnouncement(item.id)
          uni.showToast({ title: '已删除', icon: 'success' })
          fetchNotices()
        } catch (e) {}
      }
    }
  })
}

function downloadResource(item) {
  if (!item.url) {
    uni.showToast({ title: '资源链接为空', icon: 'none' })
    return
  }
  uni.setClipboardData({
    data: item.url,
    success: () => uni.showToast({ title: '链接已复制', icon: 'success' })
  })
}

function onFabTap() {
  if (currentTab.value === 'notice') {
    uni.navigateTo({ url: '/pages/announcement/publish' })
  } else {
    uni.navigateTo({ url: '/pages/announcement/upload' })
  }
}

function refresh() {
  canPublish.value = canPublishNotice() || isAdmin()
  fetchNotices()
  fetchResources()
}

onShow(() => refresh())
</script>

<style lang="scss" scoped
>
.announcement-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.tab-row { display: flex; gap: 16rpx; padding: 20rpx 32rpx; background: #fff; }
.tab-item {
  flex: 1; height: 72rpx; border-radius: 36rpx; display: flex; align-items: center; justify-content: center;
  &.active { background: #001e40; .tab-text { color: #fff; } }
}
.tab-text { font-size: 28rpx; font-weight: 500; color: #43474f; }

.content-list { padding: 24rpx 32rpx; }
.list-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 16rpx; &:active { opacity: 0.85; } }
.card-accent { width: 10rpx; background: #001e40; flex-shrink: 0; }
.card-body { flex: 1; padding: 24rpx; }
.card-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 10rpx; }
.card-summary { font-size: 24rpx; color: #43474f; line-height: 1.5; margin-bottom: 14rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-meta { display: flex; gap: 16rpx; }
.meta-time, .meta-author { font-size: 22rpx; color: #c3c6d1; }

.resource-grid { padding: 24rpx 32rpx; display: flex; flex-direction: column; gap: 14rpx; }
.resource-card {
  display: flex; align-items: center; gap: 18rpx; padding: 24rpx;
  background: #fff; border-radius: 18rpx; &:active { opacity: 0.85; }
}
.file-icon {
  width: 80rpx; height: 80rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &.pdf { background: rgba(70,0,2,0.06); .icon-text { color: #460002; } }
  &.excel { background: rgba(0,30,64,0.06); .icon-text { color: #001e40; } }
  &.word { background: rgba(70,98,112,0.08); .icon-text { color: #466270; } }
  &.image { background: rgba(0,51,102,0.05); .icon-text { color: #003366; } }
}
.icon-text { font-size: 22rpx; font-weight: 700; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 27rpx; font-weight: 500; color: #191c1e; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.download-icon { font-size: 32rpx; color: #001e40; flex-shrink: 0; }

.fab-btn {
  position: fixed; right: 32rpx; bottom: calc(120rpx + env(safe-area-inset-bottom));
  width: 104rpx; height: 104rpx; background: linear-gradient(135deg, #001e40, #003366);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.3); z-index: 99;
  &:active { transform: scale(0.95); }
}
.fab-icon { font-size: 48rpx; color: #fff; line-height: 1; }
</style>