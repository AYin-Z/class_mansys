<template>
  <div class="announcement-page">
    <custom-nav-bar title="公告资源" />
    <div scroll-y class="main-scroll">
      <div class="tab-row">
        <div :class="['tab-item', { active: currentTab === 'notice' }]" @tap="currentTab = 'notice'">
          <span class="tab-text">公告</span>
        </div>
        <div :class="['tab-item', { active: currentTab === 'resource' }]" @tap="currentTab = 'resource'">
          <span class="tab-text">资源共享</span>
        </div>
      </div>

      <!-- Notice Tab -->
      <div v-if="currentTab === 'notice'" class="content-list">
        <div v-for="item in notices" :key="item.id" class="list-card" @tap="goDetail(item)">
          <div class="card-accent"></div>
          <div class="card-body">
            <span class="card-title">{{ item.title }}</span>
            <span class="card-summary">{{ item.summary }}</span>
            <div class="card-meta">
              <span class="meta-time">{{ item.time }}</span>
              <span class="meta-author">{{ item.author }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resource Tab -->
      <div v-else class="resource-grid">
        <div v-for="item in resources" :key="item.id" class="resource-card" @tap="downloadResource(item)">
          <div :class="['file-icon', item.type]">
            <span class="icon-text">{{ fileIcon(item.type) }}</span>
          </div>
          <div class="file-info">
            <span class="file-name">{{ item.name }}</span>
            <span class="file-size">{{ item.size }} · {{ item.uploader }}</span>
          </div>
          <span class="download-icon">↓</span>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>

    <div v-if="canPublish" class="fab-btn" @tap="onFabTap">
      <span class="fab-icon">+</span>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAnnouncements, getResources, deleteAnnouncement, deleteResource } from '@/api/announcement'
import { canPublishNotice, isAdmin } from '@/utils/auth'
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
          showToast('已删除')
          fetchNotices()
        } catch (e) {}
      }
    }
  })
}

function downloadResource(item) {
  if (!item.url) {
    showToast('资源链接为空')
    return
  }
  uni.setClipboardData({
    data: item.url,
    success: () => showToast('链接已复制')
  })
}

function onFabTap() {
  if (currentTab.value === 'notice') {
    router.push('/pages/announcement/publish')
  } else {
    router.push('/pages/announcement/upload')
  }
}

function refresh() {
  canPublish.value = canPublishNotice() || isAdmin()
  fetchNotices()
  fetchResources()
}

onShow(() => refresh())

</script>

<style lang="scss" scoped>
@import "@/uni.scss";

@import "@/uni.scss";.announcement-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.tab-row { display: flex; gap: 16rpx; padding: 20rpx 32rpx; background: $surface-container-lowest; }
.tab-item {
  flex: 1; height: 72rpx; border-radius: 36rpx; display: flex; align-items: center; justify-content: center;
  &.active { background: $primary; .tab-text { color: $on-primary; } }
}
.tab-text { font-size: 28rpx; font-weight: 500; color: $on-surface-variant; }

.content-list { padding: 24rpx 32rpx; }
.list-card { position: relative; display: flex; background: $surface-container-lowest; border-radius: $radius-lg; overflow: hidden; margin-bottom: 16rpx; &:active { opacity: 0.85; } }
.card-accent { width: 10rpx; background: $primary; flex-shrink: 0; }
.card-body { flex: 1; padding: 24rpx; }
.card-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: $on-surface; display: block; margin-bottom: 10rpx; }
.card-summary { font-size: 24rpx; color: $on-surface-variant; line-height: 1.5; margin-bottom: 14rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-meta { display: flex; gap: 16rpx; }
.meta-time, .meta-author { font-size: 22rpx; color: $outline-variant; }

.resource-grid { padding: 24rpx 32rpx; display: flex; flex-direction: column; gap: 14rpx; }
.resource-card {
  display: flex; align-items: center; gap: 18rpx; padding: 24rpx;
  background: $surface-container-lowest; border-radius: $radius-lg; &:active { opacity: 0.85; }
}
.file-icon {
  width: 80rpx; height: 80rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &.pdf { background: rgba($tertiary,0.06); .icon-text { color: $tertiary; } }
  &.excel { background: rgba($primary,0.06); .icon-text { color: $primary; } }
  &.word { background: rgba($secondary,0.08); .icon-text { color: $secondary; } }
  &.image { background: rgba($primary-container,0.05); .icon-text { color: $primary-container; } }
}
.icon-text { font-size: 22rpx; font-weight: 700; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 27rpx; font-weight: 500; color: $on-surface; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 22rpx; color: $outline-variant; display: block; margin-top: 4rpx; }
.download-icon { font-size: 32rpx; color: $primary; flex-shrink: 0; }

.fab-btn {
  position: fixed; right: 32rpx; bottom: calc(120rpx + env(safe-area-inset-bottom));
  width: 104rpx; height: 104rpx; background: $gradient-primary;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba($primary,0.3); z-index: 99;
  &:active { transform: scale(0.95); }
}
.fab-icon { font-size: 48rpx; color: $on-primary; line-height: 1; }
</style>
