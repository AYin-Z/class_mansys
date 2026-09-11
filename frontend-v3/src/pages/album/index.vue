<script setup lang="ts">
/**
 * 区队相册列表
 *
 * 2026-09（相册可用性改造）：
 *  - 封面走 `cover_url`（服务端已换成 480px 缩略图）+ lazy/async + 4:3 占位，
 *    此前网格直接拉原图，一屏就是几十 MB。
 *  - 新建相册（MANAGE_ALBUM）：BaseModal + FormField，成功后 toast 并刷新。
 *  - 审核入口（APPROVE_PHOTO）：顶部「待审核 N 张」→ 弹窗内通过/驳回；
 *    待审核列表只请求一次，同一份数据同时喂卡片角标与审核弹窗。
 *  - 三态齐全：失败走 error + 重试，绝不吞成「还没有相册」。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { approvePhoto, createAlbum, deletePhoto, getAlbums, getPendingPhotos } from '@/api/album'
import type { AlbumItem, PhotoItem } from '@/api/album'
import { mediaUrl } from '@/utils/media'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const userStore = useUserStore()

const canManage = computed(() => userStore.hasPermission('MANAGE_ALBUM'))
const canApprove = computed(() => userStore.hasPermission('APPROVE_PHOTO'))

const albums = ref<AlbumItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
/** 封面加载失败的相册（避免破图） */
const brokenCovers = ref<Record<number, boolean>>({})

/* ── 待审核（只发一次请求，卡片角标与审核弹窗共用） ── */
const pendingPhotos = ref<PhotoItem[]>([])
const pendingLoading = ref(false)
const pendingError = ref<unknown>(null)
const pendingVisible = ref(false)
const reviewingId = ref<number | null>(null)

const pendingCountByAlbum = computed(() => {
  const map: Record<number, number> = {}
  for (const p of pendingPhotos.value) map[p.album_id] = (map[p.album_id] || 0) + 1
  return map
})

function pendingCount(albumId: number): number {
  return pendingCountByAlbum.value[albumId] || 0
}

async function fetchAlbums() {
  const res = await getAlbums()
  albums.value = res.albums || []
}

async function load() {
  loading.value = true
  error.value = null
  try {
    await fetchAlbums()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

async function loadPending() {
  if (!canApprove.value) return
  pendingLoading.value = true
  pendingError.value = null
  try {
    const res = await getPendingPhotos()
    pendingPhotos.value = res.photos || []
  } catch (e) {
    pendingError.value = e
  } finally {
    pendingLoading.value = false
  }
}

onMounted(() => {
  load()
  loadPending()
})

/** 审核后的静默刷新：不切 loading 态，列表不闪白 */
async function refreshAfterReview() {
  try {
    await Promise.all([fetchAlbums(), loadPending()])
  } catch (e) {
    toastIfNotNotified(e, '相册列表刷新失败，请稍后重试')
  }
}

/* ── 新建相册 ── */
const createVisible = ref(false)
const creating = ref(false)
const nameInput = ref('')
const descInput = ref('')
const nameError = ref('')

function openCreate() {
  nameInput.value = ''
  descInput.value = ''
  nameError.value = ''
  createVisible.value = true
}

async function submitCreate() {
  if (creating.value) return
  const name = nameInput.value.trim()
  if (!name) {
    nameError.value = '请填写相册名称'
    return
  }
  nameError.value = ''
  creating.value = true
  try {
    const res = await createAlbum({ name, description: descInput.value.trim() || undefined })
    if (res?.success !== false) {
      showToast('相册创建成功', 'success')
      createVisible.value = false
      await load()
    }
  } catch (e) {
    toastIfNotNotified(e, '创建相册失败，请稍后重试')
  } finally {
    creating.value = false
  }
}

/* ── 审核（通过 / 驳回） ── */
async function openPending() {
  pendingVisible.value = true
  if (pendingError.value || pendingPhotos.value.length === 0) await loadPending()
}

async function review(photo: PhotoItem, action: 'approve' | 'reject') {
  if (reviewingId.value !== null) return
  if (action === 'reject') {
    const who = photo.uploader_name || '该学员'
    const where = photo.album_name ? `《${photo.album_name}》` : '该相册'
    const ok = await showConfirm('驳回照片', `${where} 中 ${who} 上传的照片`, {
      danger: true,
      confirmText: '驳回',
      hint: '驳回会删除该照片及其文件，且无法恢复，上传者需要重新上传',
    })
    if (!ok) return
  }
  reviewingId.value = photo.id
  try {
    const res = action === 'approve' ? await approvePhoto(photo.id) : await deletePhoto(photo.id)
    if (res?.success !== false) {
      pendingPhotos.value = pendingPhotos.value.filter((p) => p.id !== photo.id)
      showToast(action === 'approve' ? '已通过审核' : '已驳回', 'success')
      await refreshAfterReview()
    }
  } catch (e) {
    toastIfNotNotified(e, action === 'approve' ? '通过失败，请稍后重试' : '驳回失败，请稍后重试')
  } finally {
    reviewingId.value = null
  }
}

function goToAlbum(id: number) {
  router.push({ path: '/pages/album/detail', query: { id: String(id) } })
}

function formatDate(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="album-page">
    <NavBar title="区队相册">
      <template #right>
        <button
          v-if="canManage"
          class="nav-action"
          type="button"
          aria-label="新建相册"
          @click="openCreate"
        >
          <AppIcon name="plus" :size="20" :stroke="2" />
        </button>
      </template>
    </NavBar>

    <!-- 审核入口：持 APPROVE_PHOTO 才显示 -->
    <button v-if="canApprove" class="pending-entry" type="button" @click="openPending">
      <span class="pending-icon"><AppIcon name="clipboard" :size="18" /></span>
      <span class="pending-text">
        <span class="pending-title">待审核照片</span>
        <span class="pending-sub">审核通过后其他同学才能看到</span>
      </span>
      <BaseBadge :variant="pendingPhotos.length > 0 ? 'warning' : 'default'">
        {{ pendingPhotos.length }} 张
      </BaseBadge>
      <AppIcon name="chevron-right" :size="16" />
    </button>

    <StateView
      :loading="loading"
      :error="error"
      :empty="albums.length === 0"
      loading-text="正在加载相册…"
      empty-icon="image"
      empty-title="还没有相册"
      :empty-description="canManage ? '创建相册后，把活动照片传进来给大家看' : '等干部创建相册后就能看照片了'"
      :empty-action-text="canManage ? '新建相册' : ''"
      empty-action-icon="plus"
      @retry="load"
      @empty-action="openCreate"
    >
      <div class="album-grid">
        <div
          v-for="item in albums"
          :key="item.id"
          class="album-card"
          role="button"
          tabindex="0"
          @click="goToAlbum(item.id)"
          @keydown.enter="goToAlbum(item.id)"
        >
          <div class="album-cover">
            <img
              v-if="item.cover_url && !brokenCovers[item.id]"
              :src="mediaUrl(item.cover_url)"
              :alt="`${item.name} 封面`"
              class="cover-img"
              loading="lazy"
              decoding="async"
              @error="brokenCovers[item.id] = true"
            />
            <div v-else class="cover-placeholder">
              <AppIcon name="image" :size="34" :stroke="1.5" />
            </div>
            <span class="photo-badge">{{ item.photo_count }} 张</span>
            <span v-if="pendingCount(item.id) > 0" class="pending-badge">
              <BaseBadge variant="warning">待审核 {{ pendingCount(item.id) }}</BaseBadge>
            </span>
          </div>
          <div class="album-info">
            <div class="album-name">{{ item.name }}</div>
            <div v-if="item.description" class="album-desc">{{ item.description }}</div>
            <div class="album-meta">
              <span>{{ item.creator_name || '未知创建者' }}</span>
              <span>{{ formatDate(item.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </StateView>

    <!-- 新建相册 -->
    <BaseModal v-model="createVisible" title="新建相册" :close-on-overlay="false">
      <div class="form-stack">
        <FormField label="相册名称" required :error="nameError">
          <input
            v-model="nameInput"
            type="text"
            maxlength="50"
            placeholder="例如：2026 秋季运动会"
            @keyup.enter="submitCreate"
          />
        </FormField>
        <FormField label="描述" hint="选填，一句话说明这个相册装什么">
          <textarea v-model="descInput" maxlength="200" rows="3" placeholder="选填" />
        </FormField>
      </div>
      <template #footer>
        <BaseButton variant="secondary" :disabled="creating" @click="createVisible = false">取消</BaseButton>
        <BaseButton :loading="creating" :disabled="creating" @click="submitCreate">创建</BaseButton>
      </template>
    </BaseModal>

    <!-- 待审核照片 -->
    <BaseModal v-model="pendingVisible" title="待审核照片">
      <StateView
        :loading="pendingLoading"
        :error="pendingError"
        :empty="pendingPhotos.length === 0"
        loading-text="正在加载待审核照片…"
        empty-icon="check-circle"
        empty-title="没有待审核的照片"
        empty-description="学员上传的照片审核通过后才会出现在相册里"
        slim
        @retry="loadPending"
      >
        <ul class="review-list">
          <li v-for="p in pendingPhotos" :key="p.id" class="review-item">
            <img
              class="review-thumb"
              :src="mediaUrl(p.thumb_url || p.url)"
              :alt="p.description || `${p.album_name || '相册'} 待审核照片`"
              loading="lazy"
              decoding="async"
            />
            <div class="review-info">
              <div class="review-album">{{ p.album_name || '未知相册' }}</div>
              <div class="review-meta">
                {{ p.uploader_name || '未知上传者' }} · {{ formatDate(p.created_at) }}
              </div>
              <div v-if="p.description" class="review-desc">{{ p.description }}</div>
            </div>
            <div class="review-actions">
              <BaseButton
                :loading="reviewingId === p.id"
                :disabled="reviewingId !== null"
                @click="review(p, 'approve')"
              >通过</BaseButton>
              <BaseButton
                variant="danger"
                :disabled="reviewingId !== null"
                @click="review(p, 'reject')"
              >驳回</BaseButton>
            </div>
          </li>
        </ul>
      </StateView>
    </BaseModal>
  </div>
</template>

<style scoped>
.album-page { min-height: 100vh; }

.nav-action {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-accent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.nav-action:active { background: var(--color-surface-hover); }

/* 审核入口 */
.pending-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 24px);
  min-height: 56px;
  margin: 12px 12px 0;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pending-entry:active { background: var(--color-surface-hover); }
.pending-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
.pending-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pending-title { font-size: var(--font-size-body); font-weight: 600; }
.pending-sub { font-size: var(--font-size-xs); color: var(--color-text-3); }

/* 相册卡片网格 */
.album-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
}
@media (min-width: 768px) { .album-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .album-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.album-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--dur-fast), background var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.album-card:active {
  transform: scale(0.98);
  background: var(--color-surface-hover);
}
.album-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;   /* 先占位，图到了也不跳动 */
  overflow: hidden;
  background: var(--color-surface-2);
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
}
.photo-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-overlay);
  color: #fff;
  font-size: var(--font-size-xs);
  line-height: 1.6;
}
.pending-badge { position: absolute; left: 6px; top: 6px; }

.album-info { padding: 10px 12px 12px; }
.album-name {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.album-desc {
  margin-top: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.album-meta {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
}
.album-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 新建表单 */
.form-stack { display: flex; flex-direction: column; gap: 14px; }

/* 待审核列表 */
.review-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.review-item { display: flex; align-items: center; gap: 10px; }
.review-thumb {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}
.review-info { flex: 1; min-width: 0; }
.review-album {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-meta { margin-top: 2px; font-size: var(--font-size-xs); color: var(--color-text-3); }
.review-desc {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
</style>
