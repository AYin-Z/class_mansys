<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getResources, deleteResource,
} from '@/api/announcement'
import { uploadFile } from '@/utils/request'
import type { AnnouncementItem, ResourceItem } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const activeTab = ref<'announcement' | 'resource'>('announcement')

// 公告
const announcements = ref<AnnouncementItem[]>([])
const loadingA = ref(true)
const showFormA = ref(false)
const formA = ref({ title: '', content: '', is_pinned: false })
const submittingA = ref(false)
const deletingA = ref<number | null>(null)

// 资源
const resources = ref<ResourceItem[]>([])
const loadingR = ref(false)
const showFormR = ref(false)
const selectedFile = ref<File | null>(null)
const formR = ref({ category: '学习' })
const fileInputR = ref<HTMLInputElement | null>(null)
const submittingR = ref(false)
const deletingR = ref<number | null>(null)

async function loadAnnouncements() {
  loadingA.value = true
  try {
    const res = await getAnnouncements()
    if (res.success) announcements.value = res.announcements || []
  } catch (_) {}
  finally { loadingA.value = false }
}

async function loadResources() {
  loadingR.value = true
  try {
    const res = await getResources()
    if (res.success) resources.value = res.resources || []
  } catch (_) {}
  finally { loadingR.value = false }
}

onMounted(async () => {
  await loadAnnouncements()
  await loadResources()
})

// ── 公告操作 ──
function openAnnouncementForm() {
  formA.value = { title: '', content: '', is_pinned: false }
  showFormA.value = true
}

async function handleCreateAnnouncement() {
  if (!formA.value.title.trim()) { showToast('请输入标题'); return }
  if (!formA.value.content.trim()) { showToast('请输入内容'); return }
  submittingA.value = true
  try {
    const res = await createAnnouncement(formA.value)
    if (res.success) {
      showToast('公告发布成功')
      showFormA.value = false
      await loadAnnouncements()
    }
  } catch (e: any) { showToast(e.message || '发布失败', 'error') }
  finally { submittingA.value = false }
}

async function handleDeleteAnnouncement(id: number) {
  if (deletingA.value === id) return
  deletingA.value = id
  try {
    const res = await deleteAnnouncement(id)
    if (res.success) {
      showToast('已删除')
      announcements.value = announcements.value.filter(a => a.id !== id)
    }
  } catch (e: any) { showToast(e.message || '删除失败', 'error') }
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
  if (!selectedFile.value) { showToast('请选择文件'); return }
  submittingR.value = true
  try {
    const res = await uploadFile('/api/announcement/resources/upload', selectedFile.value, {
      category: formR.value.category,
    })
    if (res.success) {
      showToast('资源上传成功')
      showFormR.value = false
      await loadResources()
    }
  } catch (e: any) { showToast(e.message || '上传失败', 'error') }
  finally { submittingR.value = false }
}

async function handleDeleteResource(id: number) {
  if (deletingR.value === id) return
  deletingR.value = id
  try {
    const res = await deleteResource(id)
    if (res.success) {
      showToast('已删除')
      resources.value = resources.value.filter(r => r.id !== id)
    }
  } catch (e: any) { showToast(e.message || '删除失败', 'error') }
  finally { deletingR.value = null }
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
      <span :class="['tab', { active: activeTab === 'announcement' }]" @click="activeTab = 'announcement'">公告</span>
      <span :class="['tab', { active: activeTab === 'resource' }]" @click="activeTab = 'resource'">共享资源</span>
    </div>

    <!-- ===== 公告列表 ===== -->
    <div v-if="activeTab === 'announcement'">
      <div v-if="loadingA" class="state">加载中...</div>
      <div v-else-if="announcements.length === 0" class="state">暂无公告</div>

      <div v-for="a in announcements" :key="a.id" class="card">
        <div class="card-body">
          <div class="card-title">{{ a.title }}</div>
          <div class="card-desc">{{ a.content?.replace(/<[^>]*>/g, '').slice(0, 100) || '' }}</div>
          <div class="card-meta">
            <span>{{ a.creator_name || '' }}</span>
            <span>{{ formatDate(a.created_at) }}</span>
          </div>
        </div>
        <button class="delete-btn" :disabled="deletingA === a.id" @click="handleDeleteAnnouncement(a.id)">
          {{ deletingA === a.id ? '…' : '删除' }}
        </button>
      </div>

      <button class="fab" @click="openAnnouncementForm">发布</button>
    </div>

    <!-- ===== 资源列表 ===== -->
    <div v-if="activeTab === 'resource'">
      <div v-if="loadingR" class="state">加载中...</div>
      <div v-else-if="resources.length === 0" class="state">暂无共享资源</div>

      <div v-for="r in resources" :key="r.id" class="card">
        <div class="card-body">
          <div class="card-title">{{ r.name }}</div>
          <div class="card-desc">{{ r.description || '' }}</div>
          <div class="card-meta">
            <span class="tag">{{ r.category }}</span>
            <span>{{ r.type }}</span>
            <span v-if="r.size">{{ formatSize(r.size) }}</span>
            <span>{{ formatDate(r.created_at) }}</span>
          </div>
        </div>
        <button class="delete-btn" :disabled="deletingR === r.id" @click="handleDeleteResource(r.id)">
          {{ deletingR === r.id ? '…' : '删除' }}
        </button>
      </div>

      <button class="fab" @click="openResourceForm">添加</button>
    </div>

    <!-- ===== 发布公告弹窗 ===== -->
    <div v-if="showFormA" class="overlay" @click.self="showFormA = false">
      <div class="modal">
        <h3 class="modal-title">发布公告</h3>
        <label class="form-field">
          <span class="field-label">标题</span>
          <input v-model="formA.title" class="field-input" placeholder="公告标题" />
        </label>
        <label class="form-field">
          <span class="field-label">内容</span>
          <textarea v-model="formA.content" class="field-input" rows="4" placeholder="公告内容" style="resize:vertical"></textarea>
        </label>
        <label class="form-field form-field-row">
          <span class="field-label">📌 首页置顶</span>
          <input v-model="formA.is_pinned" type="checkbox" class="field-checkbox" />
        </label>
        <div class="form-actions">
          <button class="btn-cancel" @click="showFormA = false">取消</button>
          <button class="btn-submit" :disabled="submittingA" @click="handleCreateAnnouncement">
            {{ submittingA ? '发布中…' : '发布' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 上传资源弹窗 ===== -->
    <div v-if="showFormR" class="overlay" @click.self="showFormR = false">
      <div class="modal">
        <h3 class="modal-title">上传共享资源</h3>
        <label class="form-field">
          <span class="field-label">分类</span>
          <select v-model="formR.category" class="field-input">
            <option value="学习">学习</option>
            <option value="训练">训练</option>
            <option value="制度">制度</option>
            <option value="活动">活动</option>
            <option value="其他">其他</option>
          </select>
        </label>
        <label class="form-field">
          <span class="field-label">选择文件</span>
          <div class="file-upload-area" @click="fileInputR?.click()">
            <div v-if="selectedFile" class="file-selected">
              📄 {{ selectedFile.name }}
              <span class="file-size">({{ (selectedFile.size / 1024 / 1024).toFixed(1) }} MB)</span>
            </div>
            <div v-else class="file-placeholder">点击选择文件</div>
          </div>
          <input ref="fileInputR" type="file" class="file-input-hidden" @change="handleFileSelect" />
          <div class="file-hint">支持文档、表格、演示、图片、压缩包等，最大 100MB</div>
        </label>
        <div class="form-actions">
          <button class="btn-cancel" @click="showFormR = false">取消</button>
          <button class="btn-submit" :disabled="submittingR || !selectedFile" @click="handleCreateResource">
            {{ submittingR ? '上传中…' : '上传' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

.tab-bar {
  display: flex; gap: 4px; padding: 12px 16px;
  background: var(--color-surface); border-bottom: 1px solid var(--color-border);
}
.tab {
  font-size: 13px; font-weight: 500; padding: 6px 16px;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--color-text-2); transition: all 0.15s;
}
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }

.card {
  display: flex; align-items: center; gap: 8px;
  margin: 8px 12px; padding: 12px 14px;
  border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-card);
}
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.card-desc { font-size: 13px; color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 11px; color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--color-accent-bg); color: var(--color-accent); }
.delete-btn {
  flex-shrink: 0; width: 48px; border: none; background: transparent;
  color: var(--color-error); font-size: 12px; font-weight: 600; cursor: pointer;
}
.delete-btn:disabled { opacity: 0.5; }

.fab {
  position: fixed; bottom: 24px; right: 24px;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; z-index: 50;
}

.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  overflow-y: auto;
}
.modal {
  background: var(--color-surface); border-radius: var(--radius-lg); padding: 24px;
  width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.modal-title { font-size: 18px; font-weight: 700; color: var(--color-text); margin-bottom: 20px; text-align: center; }
.form-field { display: block; margin-bottom: 16px; }
.field-label { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-2); margin-bottom: 6px; }
.field-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text);
  background: var(--color-bg); outline: none; box-sizing: border-box;
}
.field-input:focus { border-color: var(--color-accent); }
.form-actions { display: flex; gap: 10px; margin-top: 20px; }
.form-actions button {
  flex: 1; height: 42px; border: none; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-cancel { background: var(--color-surface-hover); color: var(--color-text-2); }
.btn-submit { background: var(--color-accent); color: #fff; }
.btn-submit:disabled { opacity: 0.5; }

.file-upload-area {
  padding: 24px; border: 2px dashed var(--color-border); border-radius: var(--radius-sm);
  text-align: center; cursor: pointer; transition: border-color 0.15s;
}
.file-upload-area:hover { border-color: var(--color-accent); }
.file-selected { font-size: 14px; font-weight: 500; color: var(--color-text); }
.file-size { font-size: 12px; color: var(--color-text-3); margin-left: 4px; }
.file-placeholder { font-size: 14px; color: var(--color-text-3); }
.file-hint { font-size: 11px; color: var(--color-text-3); margin-top: 6px; }
.form-field-row { display: flex; align-items: center; gap: 8px; }
.form-field-row .field-label { margin-bottom: 0; }
.field-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: var(--color-accent); }
.file-input-hidden { display: none; }
</style>
