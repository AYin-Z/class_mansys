<script setup lang="ts">
/**
 * 相册详情
 *
 * 2026-09（相册可用性改造）：
 *  - 网格只拉 `thumb_url`（480px，20–60KB），查看器用 `medium_url`（1440px），
 *    原图 `url` 只在「保存原图」时下载 —— 此前网格直出原图，翻一页几十 MB。
 *  - 上传改走统一端点 + `uploadBatch`：并发 3、失败自动重试 2 次、逐张进度、
 *    可取消剩余、失败项单独重试，压缩在客户端完成（3MB → 300KB 量级）。
 *  - 查看器：左右滑动切换（≥40px 才切）、预加载相邻两张、锁滚动、保存原图、删除。
 *  - 删除走 `DELETE /api/album/photos/:id`（同一端点：待审核=驳回）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { approvePhoto, deleteAlbum, deletePhoto, getAlbumDetail } from '@/api/album'
import type { AlbumItem, PhotoItem } from '@/api/album'
import { uploadBatch } from '@/utils/upload'
import type { BatchItemState } from '@/utils/upload'
import { mediaUrl } from '@/utils/media'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const albumId = computed(() => Number(route.query.id) || 0)
const canManage = computed(() => userStore.hasPermission('MANAGE_ALBUM'))
const canApprovePhoto = computed(() => userStore.hasPermission('APPROVE_PHOTO'))
const myId = computed(() => userStore.profile?.id ?? null)

const album = ref<AlbumItem | null>(null)
const photos = ref<PhotoItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

/** 网格图片的加载 / 失败状态（骨架与占位图标都靠它） */
const photoLoaded = ref<Record<number, boolean>>({})
const photoBroken = ref<Record<number, boolean>>({})
const coverBroken = ref(false)

async function fetchDetail() {
  const id = albumId.value
  if (!id) throw new Error('相册 ID 无效，请返回列表重新进入')
  const res = await getAlbumDetail(id)
  album.value = res.album || null
  photos.value = res.photos || []
}

async function load() {
  loading.value = true
  error.value = null
  try {
    await fetchDetail()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 上传/删除/审核后刷新照片（不切 loading 态，列表不闪白） */
async function reloadPhotos() {
  try {
    await fetchDetail()
  } catch (e) {
    toastIfNotNotified(e, '照片列表刷新失败，请下拉重试')
  }
}

/* ────────────── 上传管线 ────────────── */

interface QueueItem {
  key: string
  file: File
  /** 本地预览地址（URL.createObjectURL，清队列/卸载时必须 revoke） */
  previewUrl: string
  status: BatchItemState['status']
  progress: number
  error: string
}

const STATUS_TEXT: Record<BatchItemState['status'], string> = {
  pending: '等待中',
  compressing: '压缩中…',
  uploading: '上传中',
  done: '已完成',
  failed: '上传失败',
  canceled: '已取消',
}

const queue = ref<QueueItem[]>([])
const uploading = ref(false)
const overall = reactive({ done: 0, total: 0 })
const abortController = ref<AbortController | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)

const failedCount = computed(() => queue.value.filter((q) => q.status === 'failed').length)

function statusText(item: QueueItem): string {
  if (item.status === 'failed') return item.error || '上传失败'
  if (item.status === 'uploading') return `上传中 ${item.progress}%`
  return STATUS_TEXT[item.status] || item.status
}

function pickFromGallery() {
  if (uploading.value) return
  galleryInput.value?.click()
}

function pickFromCamera() {
  if (uploading.value) return
  cameraInput.value?.click()
}

function onPick(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''
  if (files.length === 0) return
  void startUpload(files)
}

async function startUpload(files: File[]) {
  if (uploading.value) {
    showToast('正在上传，请等本次传完再选', 'none')
    return
  }
  if (!albumId.value) {
    showToast('相册 ID 无效，请返回列表重新进入', 'error')
    return
  }

  const images = files.filter((f) => f.type.startsWith('image/'))
  const skipped = files.length - images.length
  if (images.length === 0) {
    showToast('请选择图片文件', 'error')
    return
  }
  if (skipped > 0) showToast(`${skipped} 个非图片文件已跳过`, 'none')

  // 上一批没有待重试的失败项时，先收掉旧队列（含 revoke 预览）
  if (queue.value.length > 0 && failedCount.value === 0) clearQueue()

  const stamp = Date.now()
  // 用 reactive 包一层：进度/状态是逐张高频回写的，必须自己触发更新
  // （数组元素即使是 queue.value 里的成员，直接改原始对象也不会通知视图）
  const items: QueueItem[] = images.map((file, i) =>
    reactive<QueueItem>({
      key: `${stamp}-${i}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
      error: '',
    }),
  )
  queue.value = [...queue.value, ...items]
  await runBatch(items)
}

/** 跑一批上传（新选中的 / 重试的失败项共用），逐张回写状态与进度 */
async function runBatch(targets: QueueItem[]) {
  const id = albumId.value
  if (!id) {
    showToast('相册 ID 无效，请返回列表重新进入', 'error')
    return
  }
  for (const t of targets) {
    t.status = 'pending'
    t.progress = 0
    t.error = ''
  }
  uploading.value = true
  overall.done = 0
  overall.total = targets.length
  const controller = new AbortController()
  abortController.value = controller

  try {
    const states = await uploadBatch(
      targets.map((t) => t.file),
      {
        kind: 'album',
        fields: { album_id: String(id) },
        concurrency: 3,
        retries: 2,
        imagesOnly: true,
        signal: controller.signal,
        onItem: (i, state) => {
          const target = targets[i]
          if (!target) return
          target.status = state.status
          target.progress = state.progress
          target.error = state.error || ''
        },
        onOverall: (done, total) => {
          overall.done = done
          overall.total = total
        },
      },
    )

    // 以最终状态兜底回写一次：即使某个 onItem 回调被漏掉，界面也不会停在「等待中」
    states.forEach((s, i) => {
      const target = targets[i]
      if (!target) return
      target.status = s.status
      target.progress = s.progress
      target.error = s.error || ''
    })

    const done = states.filter((s) => s.status === 'done').length
    const failed = states.filter((s) => s.status === 'failed').length
    const canceled = states.filter((s) => s.status === 'canceled').length
    const pendingReview = states.filter((s) => s.status === 'done' && s.result?.autoApproved === false).length

    const parts: string[] = []
    if (done > 0) parts.push(`${done} 张成功`)
    if (failed > 0) parts.push(`${failed} 张失败`)
    if (canceled > 0) parts.push(`${canceled} 张已取消`)
    if (parts.length > 0) showToast(parts.join('，'), failed > 0 ? 'error' : 'success')
    if (pendingReview > 0) showToast('已提交，等待干部审核', 'none')

    if (done > 0) await reloadPhotos()
  } catch (e) {
    toastIfNotNotified(e, '上传失败，请稍后重试')
  } finally {
    uploading.value = false
    abortController.value = null
  }
}

/** 取消剩余（在途请求 abort，未开始的不再发） */
function cancelUpload() {
  abortController.value?.abort()
}

/** 失败项单独重试（成功项不重来） */
function retryFailed() {
  if (uploading.value) return
  const failed = queue.value.filter((q) => q.status === 'failed')
  if (failed.length === 0) return
  void runBatch(failed)
}

function clearQueue() {
  for (const item of queue.value) URL.revokeObjectURL(item.previewUrl)
  queue.value = []
  overall.done = 0
  overall.total = 0
}

/* ────────────── 查看器 ────────────── */

const viewerIndex = ref<number | null>(null)
const viewerLoading = ref(false)
const viewerFailed = ref(false)
const deletingId = ref<number | null>(null)

const viewerPhoto = computed<PhotoItem | null>(() =>
  viewerIndex.value === null ? null : photos.value[viewerIndex.value] || null,
)
const viewerSrc = computed(() => {
  const p = viewerPhoto.value
  if (!p) return ''
  return mediaUrl(p.medium_url || p.url)
})

function openViewer(index: number) {
  viewerIndex.value = index
}

function closeViewer() {
  viewerIndex.value = null
}

function nextPhoto() {
  const n = photos.value.length
  if (viewerIndex.value === null || n === 0) return
  viewerIndex.value = (viewerIndex.value + 1) % n
}

function prevPhoto() {
  const n = photos.value.length
  if (viewerIndex.value === null || n === 0) return
  viewerIndex.value = (viewerIndex.value - 1 + n) % n
}

/** 预加载相邻两张（中图），滑动时不至于空白 */
function preloadAdjacent(index: number) {
  const n = photos.value.length
  if (n < 2) return
  for (const j of [(index + 1) % n, (index - 1 + n) % n]) {
    const p = photos.value[j]
    if (!p || j === index) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = mediaUrl(p.medium_url || p.url)
  }
}

let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  touchStartX = t.clientX
  touchStartY = t.clientY
}

/** 位移 ≥40px 且以横向为主才切图，避免和点击/纵向滑动打架 */
function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return
  if (dx < 0) nextPhoto()
  else prevPhoto()
}

function onViewerError() {
  viewerFailed.value = true
  viewerLoading.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeViewer()
  else if (e.key === 'ArrowRight') nextPhoto()
  else if (e.key === 'ArrowLeft') prevPhoto()
}

function lockScroll(lock: boolean) {
  document.body.style.overflow = lock ? 'hidden' : ''
}

watch(viewerIndex, (v) => {
  if (v === null) {
    lockScroll(false)
    document.removeEventListener('keydown', onKeydown)
    return
  }
  viewerLoading.value = true
  viewerFailed.value = false
  lockScroll(true)
  document.addEventListener('keydown', onKeydown)
  preloadAdjacent(v)
})

function basename(path: string): string {
  const clean = String(path || '').split('?')[0]
  const name = clean.split('/').filter(Boolean).pop()
  return name || 'photo.jpg'
}

/** 保存原图：预览用中图，只有这里才下原图 */
function saveOriginal(p: PhotoItem | null) {
  if (!p?.url) {
    showToast('这张照片没有原图地址', 'error')
    return
  }
  const a = document.createElement('a')
  a.href = mediaUrl(p.url)
  a.download = basename(p.url)
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 后端放宽后的删除权限：APPROVE_PHOTO / 相册创建者 / 上传者本人 */
function canDeletePhoto(p: PhotoItem | null): boolean {
  if (!p) return false
  if (canApprovePhoto.value) return true
  const me = myId.value
  if (me === null) return false
  if (album.value && Number(album.value.creator_id) === Number(me)) return true
  return Number(p.uploader_id) === Number(me)
}

async function removePhoto(p: PhotoItem | null) {
  if (!p || deletingId.value !== null) return
  const approved = !!p.is_approved
  const ok = await showConfirm(approved ? '删除照片' : '驳回照片', p.description || '这张照片', {
    danger: true,
    confirmText: approved ? '删除' : '驳回',
    hint: approved
      ? '删除会同时清理服务器上的原图与缩略图，且无法恢复'
      : '驳回会删除该照片及其文件，且无法恢复，上传者需要重新上传',
  })
  if (!ok) return
  deletingId.value = p.id
  try {
    const res = await deletePhoto(p.id)
    if (res?.success !== false) {
      showToast(approved ? '已删除' : '已驳回', 'success')
      closeViewer()
      await reloadPhotos()
    }
  } catch (e) {
    toastIfNotNotified(e, '删除失败，请稍后重试')
  } finally {
    deletingId.value = null
  }
}

/** 待审核照片的「通过」（网格角标 + 查看器入口） */
async function approveOne(p: PhotoItem) {
  if (deletingId.value !== null) return
  deletingId.value = p.id
  try {
    const res = await approvePhoto(p.id)
    if (res?.success !== false) {
      showToast('已通过审核', 'success')
      closeViewer()
      await reloadPhotos()
    }
  } catch (e) {
    toastIfNotNotified(e, '通过失败，请稍后重试')
  } finally {
    deletingId.value = null
  }
}

/* ────────────── 删除整本相册 ────────────── */

const deletingAlbum = ref(false)

async function removeAlbum() {
  const a = album.value
  if (!a || deletingAlbum.value) return
  const ok = await showConfirm('删除相册', `《${a.name}》`, {
    danger: true,
    confirmText: '删除相册',
    hint: '会删除相册内所有照片（含服务器上的文件），且无法恢复',
  })
  if (!ok) return
  deletingAlbum.value = true
  try {
    const res = await deleteAlbum(a.id)
    if (res?.success !== false) {
      showToast('相册已删除', 'success')
      router.replace('/pages/album/index')
    }
  } catch (e) {
    toastIfNotNotified(e, '删除相册失败，请稍后重试')
  } finally {
    deletingAlbum.value = false
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  lockScroll(false)
  for (const item of queue.value) URL.revokeObjectURL(item.previewUrl)
})

function formatDate(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="detail-page">
    <NavBar title="相册详情" show-back>
      <template #right>
        <button
          v-if="canManage && album"
          class="nav-action danger"
          type="button"
          aria-label="删除相册"
          @click="removeAlbum"
        >
          <AppIcon name="trash" :size="19" />
        </button>
      </template>
    </NavBar>

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
        <!-- 头部：封面用缩略图，别拉原图 -->
        <div class="album-header">
          <div class="header-cover">
            <img
              v-if="album.cover_url && !coverBroken"
              :src="mediaUrl(album.cover_url)"
              :alt="`${album.name} 封面`"
              loading="lazy"
              decoding="async"
              @error="coverBroken = true"
            />
            <div v-else class="cover-placeholder">
              <AppIcon name="image" :size="30" :stroke="1.5" />
            </div>
          </div>
          <div class="header-info">
            <h2 class="header-title">{{ album.name }}</h2>
            <p v-if="album.description" class="header-desc">{{ album.description }}</p>
            <div class="header-meta">
              <span>{{ album.creator_name || '未知创建者' }}</span>
              <span>{{ formatDate(album.created_at) }}</span>
              <span>{{ album.photo_count }} 张照片</span>
            </div>
          </div>
        </div>

        <!-- 上传入口 -->
        <div class="section-header">
          <span class="section-title">照片</span>
          <div class="upload-actions">
            <BaseButton
              variant="secondary"
              :disabled="uploading"
              @click="pickFromCamera"
            >
              <AppIcon name="camera" :size="16" />
              <span>拍照</span>
            </BaseButton>
            <BaseButton :disabled="uploading" @click="pickFromGallery">
              <AppIcon name="upload" :size="16" />
              <span>上传照片</span>
            </BaseButton>
          </div>
        </div>
        <input
          ref="galleryInput"
          class="hidden-file"
          type="file"
          accept="image/*"
          multiple
          @change="onPick"
        />
        <input
          ref="cameraInput"
          class="hidden-file"
          type="file"
          accept="image/*"
          capture="environment"
          @change="onPick"
        />

        <!-- 待上传 / 上传中队列 -->
        <section v-if="queue.length > 0" class="upload-panel">
          <header class="upload-head">
            <span class="upload-title">
              {{ uploading ? `上传中 ${overall.done}/${overall.total}` : (failedCount > 0 ? `${failedCount} 张失败` : '本次上传') }}
            </span>
            <div class="upload-head-actions">
              <BaseButton v-if="uploading" variant="secondary" @click="cancelUpload">取消剩余</BaseButton>
              <BaseButton v-else-if="failedCount > 0" variant="secondary" @click="retryFailed">重试失败项</BaseButton>
              <BaseButton v-if="!uploading" variant="ghost" @click="clearQueue">关闭</BaseButton>
            </div>
          </header>
          <ul class="queue-list">
            <li v-for="item in queue" :key="item.key" class="queue-item">
              <img class="queue-thumb" :src="item.previewUrl" :alt="item.file.name" />
              <div class="queue-info">
                <div class="queue-name">{{ item.file.name }}</div>
                <div class="queue-status" :class="`status-${item.status}`">{{ statusText(item) }}</div>
                <div class="queue-bar">
                  <div class="queue-bar-fill" :style="{ width: `${item.progress}%` }" />
                </div>
              </div>
              <AppIcon
                v-if="item.status === 'done'"
                class="queue-mark ok"
                name="check-circle"
                :size="18"
              />
              <AppIcon
                v-else-if="item.status === 'failed'"
                class="queue-mark bad"
                name="alert-circle"
                :size="18"
              />
            </li>
          </ul>
        </section>

        <EmptyState
          v-if="photos.length === 0"
          icon="camera"
          title="还没有照片"
          description="点上方「上传照片」上传第一张"
        />

        <!-- 照片网格：thumb_url 缩略图 + 骨架 + 失败占位 -->
        <div v-else class="photo-grid">
          <button
            v-for="(item, index) in photos"
            :key="item.id"
            class="photo-cell"
            :class="{ 'is-loading': !photoLoaded[item.id] && !photoBroken[item.id] }"
            type="button"
            :aria-label="item.description || `查看第 ${index + 1} 张照片`"
            @click="openViewer(index)"
          >
            <img
              v-if="!photoBroken[item.id]"
              :src="mediaUrl(item.thumb_url || item.url)"
              :alt="item.description || `${album.name} 照片 ${index + 1}`"
              class="photo-img"
              :class="{ loaded: photoLoaded[item.id] }"
              loading="lazy"
              decoding="async"
              @load="photoLoaded[item.id] = true"
              @error="photoBroken[item.id] = true"
            />
            <span v-else class="photo-fallback">
              <AppIcon name="image" :size="24" :stroke="1.5" />
            </span>
            <span v-if="!item.is_approved" class="cell-badge">
              <BaseBadge variant="warning">待审核</BaseBadge>
            </span>
          </button>
        </div>
      </template>
    </StateView>

    <!-- 查看器：全屏黑底，中图预览 + 手势切换 -->
    <Teleport to="body">
      <div
        v-if="viewerPhoto"
        class="viewer"
        role="dialog"
        aria-modal="true"
        aria-label="照片查看器"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <header class="viewer-top">
          <button class="viewer-btn" type="button" aria-label="关闭" @click="closeViewer">
            <AppIcon name="close" :size="20" />
          </button>
          <div class="viewer-counter">
            {{ (viewerIndex ?? 0) + 1 }} / {{ photos.length }}
          </div>
          <div class="viewer-top-spacer" />
        </header>

        <div class="viewer-stage" @click.self="closeViewer">
          <span v-if="viewerLoading && !viewerFailed" class="viewer-loading">
            <AppIcon name="refresh" :size="22" />
          </span>
          <div v-if="viewerFailed" class="viewer-failed">
            <AppIcon name="alert-circle" :size="26" />
            <span>图片加载失败，可试试保存原图</span>
          </div>
          <img
            v-show="!viewerFailed"
            :key="viewerPhoto.id"
            :src="viewerSrc"
            :alt="viewerPhoto.description || '照片'"
            class="viewer-img"
            decoding="async"
            @load="viewerLoading = false"
            @error="onViewerError"
            @click.stop
          />
          <button
            v-if="photos.length > 1"
            class="viewer-nav prev"
            type="button"
            aria-label="上一张"
            @click.stop="prevPhoto"
          >
            <AppIcon name="chevron-left" :size="22" />
          </button>
          <button
            v-if="photos.length > 1"
            class="viewer-nav next"
            type="button"
            aria-label="下一张"
            @click.stop="nextPhoto"
          >
            <AppIcon name="chevron-right" :size="22" />
          </button>
        </div>

        <footer class="viewer-bottom">
          <div class="viewer-info">
            <div class="viewer-uploader">
              {{ viewerPhoto.uploader_name || '未知上传者' }}
              <BaseBadge v-if="!viewerPhoto.is_approved" variant="warning">待审核</BaseBadge>
            </div>
            <div v-if="viewerPhoto.description" class="viewer-desc">{{ viewerPhoto.description }}</div>
            <div class="viewer-hint">左右滑动切换照片</div>
          </div>
          <div class="viewer-actions">
            <BaseButton variant="secondary" @click="saveOriginal(viewerPhoto)">
              <AppIcon name="download" :size="16" />
              <span>保存原图</span>
            </BaseButton>
            <BaseButton
              v-if="canApprovePhoto && !viewerPhoto.is_approved"
              :loading="deletingId === viewerPhoto.id"
              :disabled="deletingId !== null"
              @click="approveOne(viewerPhoto)"
            >
              <AppIcon name="check" :size="16" />
              <span>通过</span>
            </BaseButton>
            <BaseButton
              v-if="canDeletePhoto(viewerPhoto)"
              variant="danger"
              :loading="deletingId === viewerPhoto.id && viewerPhoto.is_approved"
              :disabled="deletingId !== null"
              @click="removePhoto(viewerPhoto)"
            >
              <AppIcon name="trash" :size="16" />
              <span>{{ viewerPhoto.is_approved ? '删除' : '驳回' }}</span>
            </BaseButton>
          </div>
        </footer>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; }

.nav-action {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-2);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.nav-action.danger { color: var(--color-error); }
.nav-action:active { background: var(--color-surface-hover); }

/* ── 头部 ── */
.album-header {
  display: flex;
  gap: 14px;
  margin: 0 12px 16px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}
.header-cover {
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-2);
}
.header-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
}
.header-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.header-title { margin: 0 0 4px; font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); }
.header-desc {
  margin: 0 0 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
}

/* ── 上传入口 ── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 10px;
}
.section-title { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); }
.upload-actions { display: flex; gap: 8px; }
.hidden-file { display: none; }

/* ── 上传队列 ── */
.upload-panel {
  margin: 0 12px 12px;
  padding: 12px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}
.upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.upload-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.upload-head-actions { display: flex; gap: 8px; }
.queue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 46vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.queue-item { display: flex; align-items: center; gap: 10px; }
.queue-thumb {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}
.queue-info { flex: 1; min-width: 0; }
.queue-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.queue-status { margin: 2px 0 4px; font-size: var(--font-size-xs); color: var(--color-text-3); }
.queue-status.status-done { color: var(--color-success); }
.queue-status.status-failed { color: var(--color-error); }
.queue-status.status-uploading { color: var(--color-accent); }
.queue-bar {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-surface-2);
  overflow: hidden;
}
.queue-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width var(--dur-base) var(--ease-out);
}
.queue-mark.ok { color: var(--color-success); }
.queue-mark.bad { color: var(--color-error); }

/* ── 照片网格 ── */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 0 12px 16px;
}
@media (min-width: 768px) { .photo-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .photo-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }

.photo-cell {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-2);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.photo-cell.is-loading { animation: cell-pulse 1.4s ease-in-out infinite; }
.photo-cell:active { transform: scale(0.98); }
@keyframes cell-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.photo-img.loaded { opacity: 1; }
.photo-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
}
.cell-badge { position: absolute; left: 4px; top: 4px; }

/* ── 查看器（全屏黑底：暗色语义在这里没有对应令牌，故用局部变量集中管理） ── */
.viewer {
  --viewer-bg: rgba(0, 0, 0, 0.94);
  --viewer-fg: #ffffff;
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  background: var(--viewer-bg);
  color: var(--viewer-fg);
  overscroll-behavior: contain;
}
.viewer-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 8px 4px;
}
.viewer-btn {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--color-overlay);
  color: var(--viewer-fg);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.viewer-btn:active { opacity: 0.8; }
.viewer-counter { flex: 1; text-align: center; font-size: var(--font-size-body); opacity: 0.85; }
.viewer-top-spacer { width: 44px; flex-shrink: 0; }

.viewer-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.viewer-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  -webkit-user-select: none;
  user-select: none;
}
.viewer-loading {
  position: absolute;
  color: var(--viewer-fg);
  opacity: 0.6;
  animation: cell-pulse 1.2s ease-in-out infinite;
}
.viewer-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  opacity: 0.75;
  text-align: center;
  padding: 0 24px;
}
.viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--color-overlay);
  color: var(--viewer-fg);
  cursor: pointer;
}
.viewer-nav.prev { left: 8px; }
.viewer-nav.next { right: 8px; }
.viewer-nav:active { opacity: 0.8; }

.viewer-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 12px calc(12px + var(--safe-bottom, 0px));
}
.viewer-info { flex: 1; min-width: 0; }
.viewer-uploader {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-body);
  font-weight: 600;
}
.viewer-desc {
  margin-top: 2px;
  font-size: var(--font-size-sm);
  opacity: 0.75;
  word-break: break-word;
}
.viewer-hint { margin-top: 4px; font-size: var(--font-size-xs); opacity: 0.5; }
.viewer-actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
