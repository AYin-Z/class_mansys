<script setup lang="ts">
/**
 * 相册详情
 *
 * 2026-09（体验修复）：
 *  - 加载失败不再被 `catch (_) {}` 吞成「相册不存在」→ error + 重试
 *  - 照片列表空态 / 上传失败聚合提示 / 审核（驳回=删除）加确认
 *  - emoji（📸🖼️✕⬇）→ AppIcon；硬编码灰 → 令牌；底部避让交给 App.vue
 */
import { mediaUrl } from '@/utils/media'
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAlbumDetail, approvePhoto, rejectPhoto } from '@/api/album'
import { uploadFile } from '@/utils/request'
import type { AlbumItem, PhotoItem } from '@/api/album'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
// 照片审核需要 APPROVE_PHOTO 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canApprovePhoto = computed(() => userStore.hasPermission('APPROVE_PHOTO'))
const reviewing = ref<number | null>(null)
const album = ref<AlbumItem | null>(null)
const photos = ref<PhotoItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

// Image viewer
const viewerVisible = ref(false)
const viewerPhoto = ref<PhotoItem | null>(null)

function openViewer(photo: PhotoItem) {
  viewerPhoto.value = photo
  viewerVisible.value = true
}

function downloadPhoto() {
  if (!viewerPhoto.value?.url) return
  const a = document.createElement('a')
  a.href = mediaUrl(viewerPhoto.value.url)
  a.download = viewerPhoto.value.url.split('/').pop() || 'photo.jpg'
  a.click()
}

// Batch upload
// 批量上传不做 MANAGE_ALBUM 收敛：后端 /api/album/photos/upload 允许相册成员上传，非管理员上传后待审核
const uploading = ref(false)
const uploadProgress = ref({ done: 0, total: 0, failed: 0 })
const fileInput = ref<HTMLInputElement | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const id = Number(route.query.id)
  if (!id) {
    loading.value = false
    return
  }
  try {
    const res = await getAlbumDetail(id)
    if (res.success) {
      album.value = res.album
      photos.value = res.photos || []
    } else {
      error.value = new Error('加载相册详情失败，请稍后重试')
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  if (files.length === 0) return

  const albumId = Number(route.query.id)
  if (!albumId) { showToast('相册 ID 无效', 'error'); return }

  // 过滤非图片
  const images = files.filter(f => f.type.startsWith('image/'))
  const skipped = files.length - images.length
  if (images.length === 0) {
    showToast('请选择图片文件', 'error')
    target.value = ''
    return
  }

  uploading.value = true
  uploadProgress.value = { done: 0, total: images.length, failed: 0 }

  // 逐个上传（可改为并发 3 个提升速度）
  for (let i = 0; i < images.length; i++) {
    const file = images[i]
    try {
      if (file.size > 20 * 1024 * 1024) {
        uploadProgress.value.failed++
        continue
      }
      await uploadFile('/api/album/photos/upload', file, { album_id: String(albumId) })
      uploadProgress.value.done++
    } catch {
      // 单张失败不中断批量：计入 failed，最后统一汇报
      uploadProgress.value.failed++
    }
  }

  uploading.value = false
  target.value = ''

  const { done, failed } = uploadProgress.value
  const msgParts = []
  if (done > 0) msgParts.push(`${done} 张成功`)
  if (failed > 0) msgParts.push(`${failed} 张失败`)
  if (skipped > 0) msgParts.push(`${skipped} 个非图片跳过`)
  if (failed > 0 && done === 0) showToast(msgParts.join('，'), 'error')
  else showToast(msgParts.join('，'), done > 0 ? 'success' : 'none')

  // 刷新照片列表
  await reloadPhotos(albumId)
}

/** 重新拉取相册照片（审核后同步列表） */
async function reloadPhotos(albumId = Number(route.query.id)) {
  if (!albumId) return
  try {
    const res = await getAlbumDetail(albumId)
    if (res.success) {
      photos.value = res.photos || []
      if (album.value) album.value.photo_count = photos.value.length
    }
  } catch (e) {
    toastIfNotNotified(e, '照片列表刷新失败，请下拉重试')
  }
}

/** 审核（通过/驳回）待审核照片，需 APPROVE_PHOTO 权限 */
async function handleReviewPhoto(photo: PhotoItem, action: 'approve' | 'reject') {
  if (reviewing.value !== null) return
  if (action === 'reject') {
    const ok = await showConfirm('驳回照片', photo.description || `照片 #${photo.id}`, {
      danger: true,
      confirmText: '驳回',
      hint: '驳回会将该照片从相册中移除，且无法恢复',
    })
    if (!ok) return
  }
  reviewing.value = photo.id
  try {
    const res = action === 'approve' ? await approvePhoto(photo.id) : await rejectPhoto(photo.id)
    if (res.success) {
      showToast(action === 'approve' ? '已通过审核' : '已驳回', 'success')
      await reloadPhotos()
    }
  } catch (e) {
    toastIfNotNotified(e, action === 'approve' ? '通过失败，请稍后重试' : '驳回失败，请稍后重试')
  } finally {
    reviewing.value = null
  }
}

function formatDate(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="detail-page">
    <NavBar title="相册详情" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="!album"
      loading-text="正在加载相册…"
      empty-icon="image"
      empty-title="相册不存在"
      empty-description="相册可能已被删除，请返回列表重新进入"
      @retry="load"
    >
      <template v-if="album">
        <!-- Album Info Header -->
        <div class="album-header">
          <div class="header-cover">
            <img
              v-if="album.cover_url"
              :src="mediaUrl(album.cover_url)"
              :alt="album.name"
              class="header-img"
            />
            <div v-else class="header-placeholder">
              <AppIcon name="image" :size="30" :stroke="1.5" />
            </div>
          </div>
          <div class="header-info">
            <h2 class="header-title">{{ album.name }}</h2>
            <p v-if="album.description" class="header-desc">{{ album.description }}</p>
            <div class="header-meta">
              <span>{{ album.creator_name || '' }}</span>
              <span>{{ formatDate(album.created_at) }}</span>
              <span>{{ album.photo_count }} 张照片</span>
            </div>
          </div>
        </div>

        <!-- Upload + Photos -->
        <div class="section-header">
          <span class="section-title">照片</span>
          <BaseButton :loading="uploading" :disabled="uploading" @click="triggerUpload">
            <AppIcon name="plus" :size="14" />
            <span>{{ uploading ? `上传中 ${uploadProgress.done}/${uploadProgress.total}` : '批量上传' }}</span>
          </BaseButton>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="file-input-hidden"
          @change="handleFileChange"
        />

        <!-- Upload progress -->
        <div v-if="uploading" class="progress-bar-wrap">
          <div class="progress-bar" :style="{ width: uploadProgress.total > 0 ? ((uploadProgress.done + uploadProgress.failed) / uploadProgress.total * 100) + '%' : '0%' }"></div>
        </div>

        <EmptyState
          v-if="photos.length === 0 && !uploading"
          icon="camera"
          title="还没有照片"
          description="点右上角「批量上传」把活动照片传进来"
        />

        <div v-if="photos.length > 0" class="photo-grid">
          <div
            v-for="item in photos"
            :key="item.id"
            class="photo-item"
            @click="openViewer(item)"
          >
            <img
              v-if="item.url"
              :src="mediaUrl(item.url)"
              :alt="item.description || album.name"
              class="photo-img"
            />
            <div v-else class="photo-placeholder">
              <AppIcon name="image" :size="24" :stroke="1.5" />
            </div>
            <p v-if="item.description" class="photo-desc">{{ item.description }}</p>
            <div class="photo-meta">
              <span>{{ item.uploader_name || '' }}</span>
            </div>
            <!-- 待审核照片：需 APPROVE_PHOTO 权限 -->
            <div v-if="canApprovePhoto && !item.is_approved" class="photo-review">
              <button
                class="review-btn ok"
                :disabled="reviewing === item.id"
                @click.stop="handleReviewPhoto(item, 'approve')"
              >通过</button>
              <button
                class="review-btn no"
                :disabled="reviewing === item.id"
                @click.stop="handleReviewPhoto(item, 'reject')"
              >驳回</button>
            </div>
          </div>
        </div>
      </template>
    </StateView>

    <!-- Image Viewer -->
    <div v-if="viewerVisible" class="viewer-overlay" @click="viewerVisible = false">
      <button class="viewer-close" type="button" aria-label="关闭" @click="viewerVisible = false">
        <AppIcon name="close" :size="20" />
      </button>
      <img
        v-if="viewerPhoto?.url"
        :src="mediaUrl(viewerPhoto.url)"
        class="viewer-img"
        @click.stop
      />
      <div class="viewer-actions">
        <span class="viewer-info">{{ viewerPhoto?.uploader_name || '' }}</span>
        <BaseButton @click="downloadPhoto">
          <AppIcon name="download" :size="16" />
          <span>保存</span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; }

.album-header {
  display: flex; gap: 14px; padding: 16px;
  background: var(--color-surface); margin: 0 12px 16px;
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
}
.header-cover {
  width: 100px; height: 100px; border-radius: var(--radius-sm);
  overflow: hidden; flex-shrink: 0; background: var(--color-surface-2);
}
.header-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.header-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center;
  justify-content: center; color: var(--color-text-3);
}
.header-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.header-title { font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); margin: 0 0 4px; }
.header-desc { font-size: var(--font-size-sm); color: var(--color-text-2); margin: 0 0 6px; }
.header-meta { font-size: var(--font-size-xs); color: var(--color-text-3); display: flex; gap: 10px; flex-wrap: wrap; }

.section-header {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 16px 10px;
}
.section-title { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); }

.file-input-hidden { display: none; }

.progress-bar-wrap {
  height: 3px; background: var(--color-border); margin: 0 16px 10px;
  border-radius: 2px; overflow: hidden;
}
.progress-bar {
  height: 100%; background: var(--color-accent);
  transition: width 0.3s ease;
  border-radius: 2px;
}

.photo-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 0 12px; }
@media (min-width: 768px) { .photo-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1100px) { .photo-grid { grid-template-columns: repeat(5, 1fr); } }
.photo-item { background: var(--color-surface); border-radius: var(--radius-md); overflow: hidden; cursor: pointer; }
.photo-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.photo-placeholder {
  width: 100%; aspect-ratio: 1; display: flex;
  align-items: center; justify-content: center;
  background: var(--color-surface-2); color: var(--color-text-3);
}
.photo-desc { font-size: var(--font-size-xs); color: var(--color-text-2); padding: 6px 8px 2px; margin: 0; }
.photo-meta { font-size: var(--font-size-xs); color: var(--color-text-3); padding: 0 8px 6px; }
.photo-review { display: flex; gap: 6px; padding: 0 8px 8px; }
.review-btn {
  flex: 1; min-height: 44px; border: none; border-radius: var(--radius-sm);
  font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
  font-family: inherit;
}
.review-btn.ok { background: var(--color-accent); color: #fff; }
.review-btn.no { background: var(--color-surface-hover); color: var(--color-text-2); }
.review-btn:disabled { opacity: 0.5; }

/* ── Viewer ── */
.viewer-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: var(--z-modal);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.viewer-close {
  position: absolute; top: 16px; right: 16px; z-index: 10;
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  color: #fff; cursor: pointer; border: none;
  background: rgba(255,255,255,0.15); border-radius: 50%;
}
.viewer-img {
  max-width: 100%; max-height: 70vh; object-fit: contain;
  -webkit-user-select: none; user-select: none;
}
.viewer-actions {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  width: 100%; max-width: 400px; padding: 16px 24px;
  color: #fff;
}
.viewer-info { font-size: var(--font-size-body); opacity: 0.7; }
</style>
