<script setup lang="ts">
/**
 * 相册详情
 *
 * 2026-09（相册可用性改造）：
 *  - 网格只拉 `thumb_url`（480px，20–60KB），查看器用 `medium_url`（1440px），
 *    原图 `url` 只在「保存原图」时下载 —— 此前网格直出原图，翻一页几十 MB。
 *  - 上传改走统一端点 + `uploadBatch`：并发 3、失败自动重试 2 次、逐张进度、
 *    可取消剩余、失败项单独重试，压缩在客户端完成（3MB → 300KB 量级）。
 *  - 查看器：统一走公共组件 `@/components/ui/ImageViewer.vue`
 *    （中图分级加载 + 失败回退、左右滑动、预加载相邻、键盘、滚动锁都在组件里）。
 *  - 删除走 `DELETE /api/album/photos/:id`（同一端点：待审核=驳回）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
import ImageViewer from '@/components/ui/ImageViewer.vue'
import type { ViewerImage } from '@/components/ui/ImageViewer.vue'

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

/* ────────────── 查看器（统一走公共组件 ImageViewer） ────────────── */

/** 当前查看的照片下标；null = 查看器关闭（沿用原来的语义） */
const viewerIndex = ref<number | null>(null)
const deletingId = ref<number | null>(null)

/** v-model 需要布尔值：开关状态仍由 viewerIndex 表达 */
const viewerOpen = computed({
  get: () => viewerIndex.value !== null,
  set: (open: boolean) => {
    if (!open) viewerIndex.value = null
  },
})

/** 起始下标：组件只在「打开」那一刻读取它 */
const viewerStart = computed(() => viewerIndex.value ?? 0)

/**
 * 查看器图片列表：只传原图地址，中图由组件按 `_medium` 约定推导
 * （派生图缺失时组件内部回退原图；只有保存/下载才用原图）
 */
const viewerImages = computed<ViewerImage[]>(() =>
  photos.value.map((p) => ({
    url: p.url,
    title: p.uploader_name || '未知上传者',
    description: p.description || '',
    deletable: canDeletePhoto(p),
  })),
)

function openViewer(index: number) {
  viewerIndex.value = index
}

function closeViewer() {
  viewerIndex.value = null
}

/** 插槽只给下标，这里按下标取回照片 */
function photoAt(index: number): PhotoItem | null {
  return photos.value[index] || null
}

function approveFromViewer(index: number) {
  const p = photoAt(index)
  if (p) void approveOne(p)
}

/**
 * 查看器里删除/驳回：删除逻辑不变（二次确认 → 接口 → 提示 → 刷新），
 * 只是不再无条件关闭查看器 —— 删完还能接着看剩下的照片。
 */
async function onViewerDelete(index: number) {
  const p = photoAt(index)
  if (!p) return
  const removed = await removePhoto(p)
  if (!removed) return
  // 相册空了，或删掉的是最后一张（组件内部下标会越界）→ 收掉查看器
  if (photos.value.length === 0 || index >= photos.value.length) {
    closeViewer()
    return
  }
  // 后一张顶上来了：页面侧下标跟上
  viewerIndex.value = index
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

/** 删除/驳回照片；返回是否真的删掉了（查看器怎么收尾交给调用方） */
async function removePhoto(p: PhotoItem | null): Promise<boolean> {
  if (!p || deletingId.value !== null) return false
  const approved = !!p.is_approved
  const ok = await showConfirm(approved ? '删除照片' : '驳回照片', p.description || '这张照片', {
    danger: true,
    confirmText: approved ? '删除' : '驳回',
    hint: approved
      ? '删除会同时清理服务器上的原图与缩略图，且无法恢复'
      : '驳回会删除该照片及其文件，且无法恢复，上传者需要重新上传',
  })
  if (!ok) return false
  deletingId.value = p.id
  try {
    const res = await deletePhoto(p.id)
    if (res?.success !== false) {
      showToast(approved ? '已删除' : '已驳回', 'success')
      await reloadPhotos()
      return true
    }
  } catch (e) {
    toastIfNotNotified(e, '删除失败，请稍后重试')
  } finally {
    deletingId.value = null
  }
  return false
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
  // 键盘/滚动锁由 ImageViewer 自己收尾，这里只回收本地预览地址
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

    <!-- 全屏查看器：统一走公共组件（中图回退、滑动、键盘、滚动锁都在组件内） -->
    <ImageViewer v-model="viewerOpen" :images="viewerImages" :start-index="viewerStart">
      <!-- 待审核状态：自写查看器时的角标，改用组件的 #meta 插槽保留 -->
      <template #meta="{ index: i }">
        <BaseBadge v-if="photoAt(i) && !photoAt(i)?.is_approved" variant="warning">待审核</BaseBadge>
      </template>
      <!-- 相册除了默认的「保存原图 / 删除」，还要「通过审核」，且未审核时文案是「驳回」 -->
      <template #actions="{ index: i, save }">
        <BaseButton variant="secondary" @click="save">
          <AppIcon name="download" :size="16" />
          <span>保存原图</span>
        </BaseButton>
        <BaseButton
          v-if="photoAt(i) && canApprovePhoto && !photoAt(i)?.is_approved"
          :loading="deletingId === photoAt(i)?.id"
          :disabled="deletingId !== null"
          @click="approveFromViewer(i)"
        >
          <AppIcon name="check" :size="16" />
          <span>通过</span>
        </BaseButton>
        <BaseButton
          v-if="photoAt(i) && canDeletePhoto(photoAt(i))"
          variant="danger"
          :loading="deletingId === photoAt(i)?.id"
          :disabled="deletingId !== null"
          @click="onViewerDelete(i)"
        >
          <AppIcon name="trash" :size="16" />
          <span>{{ photoAt(i)?.is_approved ? '删除' : '驳回' }}</span>
        </BaseButton>
      </template>
    </ImageViewer>
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

</style>
