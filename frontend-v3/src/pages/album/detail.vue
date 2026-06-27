<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAlbumDetail } from '@/api/album'
import { uploadFile } from '@/utils/request'
import type { AlbumItem, PhotoItem } from '@/api/album'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const route = useRoute()
const album = ref<AlbumItem | null>(null)
const photos = ref<PhotoItem[]>([])
const loading = ref(true)

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
  a.href = viewerPhoto.value.url
  a.download = viewerPhoto.value.url.split('/').pop() || 'photo.jpg'
  a.click()
}

// Batch upload
const uploading = ref(false)
const uploadProgress = ref({ done: 0, total: 0, failed: 0 })
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    const id = Number(route.query.id)
    if (!id) return
    const res = await getAlbumDetail(id)
    if (res.success) {
      album.value = res.album
      photos.value = res.photos || []
    }
  } catch (_) {}
  finally { loading.value = false }
})

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
    } catch (_) {
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
  showToast(msgParts.join('，'))

  // 刷新照片列表
  const res = await getAlbumDetail(albumId)
  if (res.success) {
    photos.value = res.photos || []
    if (album.value) album.value.photo_count = photos.value.length
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

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="!album" class="state-text">相册不存在</div>

    <template v-else>
      <!-- Album Info Header -->
      <div class="album-header">
        <div class="header-cover">
          <img
            v-if="album.cover_url"
            :src="album.cover_url"
            :alt="album.name"
            class="header-img"
          />
          <div v-else class="header-placeholder">📸</div>
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
        <button class="upload-btn" :disabled="uploading" @click="triggerUpload">
          {{ uploading ? `上传中 ${uploadProgress.done}/${uploadProgress.total}` : '+ 批量上传' }}
        </button>
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

      <div v-if="photos.length === 0 && !uploading" class="state-text">暂无照片，点击上方按钮批量上传</div>

      <div v-if="photos.length > 0" class="photo-grid">
        <div
          v-for="item in photos"
          :key="item.id"
          class="photo-item"
          @click="openViewer(item)"
        >
          <img
            v-if="item.url"
            :src="item.url"
            :alt="item.description || album.name"
            class="photo-img"
          />
          <div v-else class="photo-placeholder">
            <span class="photo-icon">🖼️</span>
          </div>
          <p v-if="item.description" class="photo-desc">{{ item.description }}</p>
          <div class="photo-meta">
            <span>{{ item.uploader_name || '' }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Image Viewer -->
    <div v-if="viewerVisible" class="viewer-overlay" @click="viewerVisible = false">
      <div class="viewer-close" @click="viewerVisible = false">✕</div>
      <img
        v-if="viewerPhoto?.url"
        :src="viewerPhoto.url"
        class="viewer-img"
        @click.stop
      />
      <div class="viewer-actions">
        <span class="viewer-info">{{ viewerPhoto?.uploader_name || '' }}</span>
        <button class="viewer-dl" @click="downloadPhoto">⬇ 保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page { padding-bottom: 80px; }
.state-text { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

.album-header {
  display: flex; gap: 14px; padding: 16px;
  background: var(--color-surface); margin: 0 12px 16px;
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
}
.header-cover {
  width: 100px; height: 100px; border-radius: var(--radius-sm);
  overflow: hidden; flex-shrink: 0; background: #f0f0f0;
}
.header-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.header-placeholder {
  width: 100%; height: 100%; display: flex;
  align-items: center; justify-content: center; font-size: 36px; opacity: 0.5;
}
.header-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.header-title { font-size: 17px; font-weight: 700; color: var(--color-text); margin: 0 0 4px; }
.header-desc { font-size: 13px; color: var(--color-text-2); margin: 0 0 6px; }
.header-meta { font-size: 11px; color: var(--color-text-3); display: flex; gap: 10px; }

.section-header {
  display: flex; align-items: center; justify-content: space-between; padding: 0 16px 10px;
}
.section-title { font-size: 15px; font-weight: 600; color: var(--color-text); }
.upload-btn {
  padding: 6px 14px; border: none; border-radius: var(--radius-sm);
  background: var(--color-accent); color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.upload-btn:disabled { opacity: 0.5; }

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
  align-items: center; justify-content: center; background: #e8e8e8;
}
.photo-icon { font-size: 28px; opacity: 0.5; }
.photo-desc { font-size: 12px; color: var(--color-text-2); padding: 6px 8px 2px; margin: 0; }
.photo-meta { font-size: 10px; color: var(--color-text-3); padding: 0 8px 6px; }

/* ── Viewer ── */
.viewer-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 200;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.viewer-close {
  position: absolute; top: 16px; right: 16px; z-index: 10;
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 24px; cursor: pointer;
  background: rgba(255,255,255,0.15); border-radius: 50%;
}
.viewer-img {
  max-width: 100%; max-height: 70vh; object-fit: contain;
  -webkit-user-select: none; user-select: none;
}
.viewer-actions {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; max-width: 400px; padding: 16px 24px;
  color: #fff;
}
.viewer-info { font-size: 14px; opacity: 0.7; }
.viewer-dl {
  padding: 8px 20px; border: none; border-radius: var(--radius-sm);
  background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer;
}
</style>
