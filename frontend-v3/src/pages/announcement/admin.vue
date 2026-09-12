<script setup lang="ts">
/**
 * 公告管理（干部）
 *
 * 2026-09 体验修复：
 *  - 公告 / 共享资源两个列表各自 loading / error+retry / empty 三态
 *    （原来 `catch (_) {}` 会把加载失败渲染成「暂无公告 / 暂无共享资源」）；
 *  - 删除公告、删除资源均加二次确认并写明后果；
 *  - 两个手写遮罩弹窗换成 BaseModal + FormField（去掉 rgba 遮罩、z-index:100 硬编码）；
 *  - 发布 / 上传 / 删除按钮 loading 防重复提交；失败提示走 toastIfNotNotified；
 *  - emoji（📌📄）换 AppIcon，分类标签换 BaseBadge。
 */
import { ref, onMounted, computed } from 'vue'
import {
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getResources, deleteResource,
} from '@/api/announcement'
import { uploadFile } from '@/utils/request'
import type { AnnouncementItem, AnnouncementRevision, ResourceItem } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'
import { getAnnouncementRevisions, getAnnouncementRevision, revertAnnouncement } from '@/api/announcement'
import { toastIfNotNotified } from '@/utils/request'
import { sanitizeHtml } from '@/utils/sanitize'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
// 公告发布/删除需要 PUBLISH_ANNOUNCEMENT 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canPublishAnnouncement = computed(() => userStore.hasPermission('PUBLISH_ANNOUNCEMENT'))
// 共享资源上传/删除需要 UPLOAD_RESOURCE 权限
const canUploadResource = computed(() => userStore.hasPermission('UPLOAD_RESOURCE'))

const activeTab = ref<'announcement' | 'resource'>('announcement')

// 公告
const announcements = ref<AnnouncementItem[]>([])
const loadingA = ref(true)
const errorA = ref<unknown>(null)
const showFormA = ref(false)
const formA = ref({ title: '', content: '', is_pinned: false })
const submittingA = ref(false)
const deletingA = ref<number | null>(null)

// 资源
const resources = ref<ResourceItem[]>([])
const loadingR = ref(false)
const errorR = ref<unknown>(null)
const showFormR = ref(false)
const selectedFile = ref<File | null>(null)
const formR = ref({ category: '学习' })
const fileInputR = ref<HTMLInputElement | null>(null)
const submittingR = ref(false)
const deletingR = ref<number | null>(null)

async function loadAnnouncements() {
  loadingA.value = true
  errorA.value = null
  try {
    const res = await getAnnouncements()
    if (res.success) announcements.value = res.announcements || []
  } catch (e) {
    errorA.value = e
    announcements.value = []
  } finally { loadingA.value = false }
}

async function loadResources() {
  loadingR.value = true
  errorR.value = null
  try {
    const res = await getResources()
    if (res.success) resources.value = res.resources || []
  } catch (e) {
    errorR.value = e
    resources.value = []
  } finally { loadingR.value = false }
}

onMounted(async () => {
  await loadAnnouncements()
  await loadResources()
})

// ── 修改记录（P3-4）──
const revisionsOpen = ref(false)
const revisionsTarget = ref<AnnouncementItem | null>(null)
const revisions = ref<AnnouncementRevision[]>([])
const revisionsLoading = ref(false)
const revisionsError = ref<unknown>(null)
const previewing = ref<{ version: number; title: string; content: string; source: string; editor: string; at: string } | null>(null)
const revertingVersion = ref<number | null>(null)

async function openRevisions(a: AnnouncementItem) {
  revisionsTarget.value = a
  revisions.value = []
  revisionsError.value = null
  previewing.value = null
  revisionsOpen.value = true
  revisionsLoading.value = true
  try {
    const res = await getAnnouncementRevisions(a.id)
    if (res.success) revisions.value = res.revisions || []
    else revisionsError.value = new Error('加载修改记录失败')
  } catch (e) {
    revisionsError.value = e
  } finally {
    revisionsLoading.value = false
  }
}

/** 查看某个历史版本的完整内容 */
async function previewRevision(version: number) {
  if (!revisionsTarget.value) return
  try {
    const res = await getAnnouncementRevision(revisionsTarget.value.id, version)
    if (res.success && res.revision) {
      previewing.value = {
        version: res.revision.version,
        title: res.revision.title,
        content: res.revision.content,
        source: res.revision.source,
        editor: res.revision.editor_name || '—',
        at: formatDateTime(res.revision.created_at),
      }
    }
  } catch (e) {
    toastIfNotNotified(e, '加载该版本失败')
  }
}

/** 回退到历史版本：会生成新版本，历史保留 */
async function handleRevert(version: number) {
  if (!revisionsTarget.value) return
  const ok = await showConfirm(
    '回退公告',
    `《${revisionsTarget.value.title}》回退到 v${version}？`,
    {
      confirmText: `回退到 v${version}`,
      danger: true,
      hint: '回退会把当前内容替换为该版本，并生成一个新版本（历史不会丢失，可再次回退）',
    },
  )
  if (!ok) return
  revertingVersion.value = version
  try {
    const res = await revertAnnouncement(revisionsTarget.value.id, version)
    if (res.success) {
      showToast(res.message || `已回退到 v${version}`, 'success')
      await Promise.all([loadAnnouncements(), previewRevision(version)])
      await openRevisions(revisionsTarget.value)
    }
  } catch (e) {
    toastIfNotNotified(e, '回退失败，请稍后重试')
  } finally {
    revertingVersion.value = null
  }
}

function revisionSourceLabel(source: string): string {
  return ({ publish: '首次发布', edit: '编辑', revert: '回退' } as Record<string, string>)[source] || source
}

// ── 公告操作 ──
function openAnnouncementForm() {
  formA.value = { title: '', content: '', is_pinned: false }
  showFormA.value = true
}

async function handleCreateAnnouncement() {
  if (submittingA.value) return
  if (!formA.value.title.trim()) { showToast('请输入标题', 'error'); return }
  if (!formA.value.content.trim()) { showToast('请输入内容', 'error'); return }
  submittingA.value = true
  try {
    const res = await createAnnouncement(formA.value)
    if (res.success) {
      showToast('公告发布成功', 'success')
      showFormA.value = false
      await loadAnnouncements()
    }
  } catch (e) { toastIfNotNotified(e, '发布失败，请重试') }
  finally { submittingA.value = false }
}

async function handleDeleteAnnouncement(id: number) {
  if (deletingA.value === id) return
  const target = announcements.value.find(a => a.id === id)
  const ok = await showConfirm('删除公告', `《${target?.title || '该公告'}》`, {
    confirmText: '删除',
    danger: true,
    hint: '删除后学员端立即不可见，且无法恢复。',
  })
  if (!ok) return
  deletingA.value = id
  try {
    const res = await deleteAnnouncement(id)
    if (res.success) {
      showToast('公告已删除', 'success')
      announcements.value = announcements.value.filter(a => a.id !== id)
    } else {
      showToast('删除失败，请重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '删除失败，请重试') }
  finally { deletingA.value = null }
}

// ── 资源操作 ──
function openResourceForm() {
  formR.value = { category: '学习' }
  selectedFile.value = null
  showFormR.value = true
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  selectedFile.value = target.files?.[0] || null
}

async function handleCreateResource() {
  if (submittingR.value) return
  if (!selectedFile.value) { showToast('请选择文件', 'error'); return }
  submittingR.value = true
  try {
    const res = await uploadFile('/api/announcement/resources/upload', selectedFile.value, {
      category: formR.value.category,
    })
    if (res.success) {
      showToast('资源上传成功', 'success')
      showFormR.value = false
      await loadResources()
    }
  } catch (e) { toastIfNotNotified(e, '上传失败，请重试') }
  finally { submittingR.value = false }
}

async function handleDeleteResource(id: number) {
  if (deletingR.value === id) return
  const target = resources.value.find(r => r.id === id)
  const ok = await showConfirm('删除共享资源', `《${target?.name || '该资源'}》`, {
    confirmText: '删除',
    danger: true,
    hint: '删除后学员端资源库立即不可见，且无法恢复。',
  })
  if (!ok) return
  deletingR.value = id
  try {
    const res = await deleteResource(id)
    if (res.success) {
      showToast('资源已删除', 'success')
      resources.value = resources.value.filter(r => r.id !== id)
    } else {
      showToast('删除失败，请重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '删除失败，请重试') }
  finally { deletingR.value = null }
}

function formatDateTime(t: string) {
  if (!t) return ''
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}
</script>

<template>
  <div class="manage-page">
    <NavBar title="公告管理" show-back />

    <!-- Tab -->
    <div class="tab-bar">
      <button
        type="button"
        :class="['tab', { active: activeTab === 'announcement' }]"
        @click="activeTab = 'announcement'"
      >公告</button>
      <button
        type="button"
        :class="['tab', { active: activeTab === 'resource' }]"
        @click="activeTab = 'resource'"
      >共享资源</button>
    </div>

    <!-- ===== 公告列表 ===== -->
    <div v-if="activeTab === 'announcement'">
      <StateView
        :loading="loadingA"
        :error="errorA"
        :empty="announcements.length === 0"
        loading-text="正在加载公告…"
        empty-icon="megaphone"
        empty-title="还没有发布过公告"
        empty-description="发布后学员端会立即看到"
        :empty-action-text="canPublishAnnouncement ? '发布公告' : ''"
        @retry="loadAnnouncements"
        @empty-action="openAnnouncementForm"
      >
        <div v-for="a in announcements" :key="a.id" class="card">
          <div class="card-body">
            <div class="card-title">{{ a.title }}</div>
            <div class="card-desc">{{ a.content?.replace(/<[^>]*>/g, '').slice(0, 100) || '' }}</div>
            <div class="card-meta">
              <span>{{ a.creator_name || '' }}</span>
              <span>{{ formatDate(a.created_at) }}</span>
              <span v-if="a.revision_count">共 {{ a.revision_count }} 个版本</span>
            </div>
          </div>
          <button
            v-if="canPublishAnnouncement"
            class="history-btn"
            type="button"
            :aria-label="`查看修改记录：${a.title}`"
            @click="openRevisions(a)"
          >
            <AppIcon name="refresh" :size="17" />
          </button>
          <button
            v-if="canPublishAnnouncement"
            class="delete-btn"
            type="button"
            :disabled="deletingA === a.id"
            :aria-label="`删除公告：${a.title}`"
            @click="handleDeleteAnnouncement(a.id)"
          >
            <AppIcon v-if="deletingA !== a.id" name="trash" :size="17" />
            <span v-else class="dot-loading" aria-hidden="true" />
          </button>
        </div>
      </StateView>

      <button
        v-if="canPublishAnnouncement"
        class="fab"
        type="button"
        aria-label="发布公告"
        @click="openAnnouncementForm"
      >
        <AppIcon name="plus" :size="24" />
      </button>
    </div>

    <!-- 修改记录（P3-4）：版本列表 + 查看内容 + 回退 -->
    <BaseModal v-model="revisionsOpen" title="公告修改记录" max-width="420px">
      <div v-if="revisionsTarget" class="rev-head">
        <div class="rev-title">{{ revisionsTarget.title }}</div>
        <div class="rev-sub">共 {{ revisions.length }} 个版本，最新在上</div>
      </div>

      <div v-if="revisionsLoading" class="rev-loading">加载中…</div>
      <div v-else-if="revisionsError" class="rev-error">
        修改记录加载失败
        <BaseButton variant="text" size="sm" @click="revisionsTarget && openRevisions(revisionsTarget)">重试</BaseButton>
      </div>
      <div v-else class="rev-list">
        <div v-for="r in revisions" :key="r.id" class="rev-item">
          <div class="rev-line">
            <span class="rev-ver">v{{ r.version }}</span>
            <BaseBadge :variant="r.source === 'revert' ? 'warning' : r.source === 'publish' ? 'info' : 'default'">
              {{ revisionSourceLabel(r.source) }}
            </BaseBadge>
            <span class="rev-who">{{ r.editor_name || '—' }}</span>
            <span class="rev-at">{{ formatDateTime(r.created_at) }}</span>
          </div>
          <div class="rev-title-line">{{ r.title }}</div>
          <div class="rev-actions">
            <BaseButton variant="text" size="sm" @click="previewRevision(r.version)">查看内容</BaseButton>
            <BaseButton
              v-if="r.version !== revisions[0]?.version"
              variant="ghost"
              size="sm"
              :loading="revertingVersion === r.version"
              @click="handleRevert(r.version)"
            >回退到此版本</BaseButton>
            <span v-else class="rev-current">当前版本</span>
          </div>
        </div>
      </div>

      <div v-if="previewing" class="rev-preview">
        <div class="rev-preview-head">
          v{{ previewing.version }} · {{ revisionSourceLabel(previewing.source) }} · {{ previewing.editor }} · {{ previewing.at }}
        </div>
        <div class="rev-preview-title">{{ previewing.title }}</div>
        <div class="rev-preview-body" v-html="sanitizeHtml(previewing.content)"></div>
      </div>
    </BaseModal>

    <!-- ===== 资源列表 ===== -->
    <div v-if="activeTab === 'resource'">
      <StateView
        :loading="loadingR"
        :error="errorR"
        :empty="resources.length === 0"
        loading-text="正在加载资源…"
        empty-icon="folder"
        empty-title="还没有共享资源"
        empty-description="上传学习资料后，学员可以在公共资源库下载"
        :empty-action-text="canUploadResource ? '上传资源' : ''"
        @retry="loadResources"
        @empty-action="openResourceForm"
      >
        <div v-for="r in resources" :key="r.id" class="card">
          <div class="card-body">
            <div class="card-title">{{ r.name }}</div>
            <div class="card-desc">{{ r.description || '' }}</div>
            <div class="card-meta">
              <BaseBadge variant="info">{{ r.category }}</BaseBadge>
              <span>{{ r.type }}</span>
              <span v-if="r.size">{{ formatSize(r.size) }}</span>
              <span>{{ formatDate(r.created_at) }}</span>
            </div>
          </div>
          <button
            v-if="canUploadResource"
            class="delete-btn"
            type="button"
            :disabled="deletingR === r.id"
            :aria-label="`删除资源：${r.name}`"
            @click="handleDeleteResource(r.id)"
          >
            <AppIcon v-if="deletingR !== r.id" name="trash" :size="17" />
            <span v-else class="dot-loading" aria-hidden="true" />
          </button>
        </div>
      </StateView>

      <button
        v-if="canUploadResource"
        class="fab"
        type="button"
        aria-label="上传共享资源"
        @click="openResourceForm"
      >
        <AppIcon name="plus" :size="24" />
      </button>
    </div>

    <!-- ===== 发布公告弹窗 ===== -->
    <BaseModal v-model="showFormA" title="发布公告" :close-on-overlay="false">
      <div class="form">
        <FormField label="标题" required>
          <input v-model="formA.title" placeholder="公告标题" />
        </FormField>
        <FormField label="内容" required>
          <textarea v-model="formA.content" rows="4" placeholder="公告内容"></textarea>
        </FormField>
        <label class="check-row">
          <span class="check-label">首页置顶</span>
          <input v-model="formA.is_pinned" type="checkbox" class="field-checkbox" />
        </label>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showFormA = false">取消</BaseButton>
        <BaseButton :loading="submittingA" @click="handleCreateAnnouncement">发布</BaseButton>
      </template>
    </BaseModal>

    <!-- ===== 上传资源弹窗 ===== -->
    <BaseModal v-model="showFormR" title="上传共享资源" :close-on-overlay="false">
      <div class="form">
        <FormField label="分类">
          <select v-model="formR.category">
            <option value="学习">学习</option>
            <option value="训练">训练</option>
            <option value="制度">制度</option>
            <option value="活动">活动</option>
            <option value="其他">其他</option>
          </select>
        </FormField>
        <FormField label="选择文件" hint="支持文档、表格、演示、图片、压缩包等，最大 100MB">
          <button type="button" class="file-upload-area" @click="fileInputR?.click()">
            <template v-if="selectedFile">
              <AppIcon name="file" :size="20" />
              <span class="file-selected">{{ selectedFile.name }}</span>
              <span class="file-size">({{ (selectedFile.size / 1024 / 1024).toFixed(1) }} MB)</span>
            </template>
            <template v-else>
              <AppIcon name="upload" :size="20" />
              <span class="file-placeholder">点击选择文件</span>
            </template>
          </button>
          <input ref="fileInputR" type="file" class="file-input-hidden" @change="handleFileSelect" />
        </FormField>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showFormR = false">取消</BaseButton>
        <BaseButton
          :loading="submittingR"
          :disabled="!selectedFile"
          @click="handleCreateResource"
        >上传</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.history-btn {
  width: 44px; height: 44px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text-3); cursor: pointer;
  border-radius: var(--radius-sm);
}
.history-btn:active { background: var(--color-surface-hover); }
.rev-head { margin-bottom: 10px; }
.rev-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.rev-sub { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 2px; }
.rev-loading, .rev-error { font-size: var(--font-size-sm); color: var(--color-text-3); padding: 12px 0; }
.rev-list { display: flex; flex-direction: column; gap: 8px; max-height: 44vh; overflow-y: auto; }
.rev-item {
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  padding: 10px 12px; background: var(--color-surface);
}
.rev-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rev-ver { font-weight: 700; color: var(--color-text); font-size: var(--font-size-sm); }
.rev-who { font-size: var(--font-size-xs); color: var(--color-text-2); }
.rev-at { font-size: var(--font-size-2xs); color: var(--color-text-3); margin-left: auto; }
.rev-title-line {
  font-size: var(--font-size-sm); color: var(--color-text); margin-top: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rev-actions { display: flex; align-items: center; gap: 4px; margin-top: 6px; }
.rev-current { font-size: var(--font-size-2xs); color: var(--color-success); margin-left: auto; }
.rev-preview {
  margin-top: 12px; padding: 12px; border-radius: var(--radius-md);
  background: var(--color-surface-2); max-height: 40vh; overflow-y: auto;
}
.rev-preview-head { font-size: var(--font-size-xs); color: var(--color-text-3); margin-bottom: 6px; }
.rev-preview-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.rev-preview-body { font-size: var(--font-size-sm); color: var(--color-text-2); line-height: 1.6; word-break: break-word; }
.rev-preview-body :deep(img) { max-width: 100%; }
.manage-page { min-height: 100vh; background: var(--color-bg); }

.tab-bar {
  display: flex; gap: 4px; padding: 8px 16px;
  background: var(--color-surface); border-bottom: 1px solid var(--color-border);
}
.tab {
  min-height: 44px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--font-size-sm); font-weight: 500;
  color: var(--color-text-2);
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }

.card {
  display: flex; align-items: center; gap: 8px;
  margin: 8px 12px; padding: 12px 14px;
  border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-card);
}
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.card-desc { font-size: var(--font-size-sm); color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: var(--font-size-xs); color: var(--color-text-2); margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.delete-btn {
  flex-shrink: 0;
  width: 44px;
  min-height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-error);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.delete-btn:active { background: var(--color-error-bg); }
.delete-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dot-loading {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: dot-spin 0.7s linear infinite;
}
@keyframes dot-spin { to { transform: rotate(360deg); } }

.fab {
  position: fixed;
  bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
  right: 24px;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--color-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-lift); cursor: pointer;
  transition: transform var(--dur-fast);
  z-index: var(--z-fab);
  -webkit-tap-highlight-color: transparent;
}
.fab:active { transform: scale(0.92); }

/* 弹窗内表单 */
.form { display: flex; flex-direction: column; gap: 14px; }
.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
}
.check-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-2); }
.field-checkbox { width: 20px; height: 20px; cursor: pointer; accent-color: var(--color-accent); }

.file-upload-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 20px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-2);
  font-family: inherit;
  cursor: pointer;
  transition: border-color var(--dur-fast);
}
.file-upload-area:active { border-color: var(--color-accent); }
.file-selected { font-size: var(--font-size-body); font-weight: 500; color: var(--color-text); word-break: break-all; }
.file-size { font-size: var(--font-size-xs); color: var(--color-text-2); }
.file-placeholder { font-size: var(--font-size-body); color: var(--color-text-2); }
.file-input-hidden { display: none; }
</style>
