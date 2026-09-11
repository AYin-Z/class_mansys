<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getNotices, getUnreadCount, createNotice, deleteNotice } from '@/api/notice'
import type { NoticeItem, NoticeCreateParams } from '@/api/notice'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
// 发布/删除通知需要 MANAGE_NOTICE 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canManageNotice = computed(() => userStore.hasPermission('MANAGE_NOTICE'))

const notices = ref<NoticeItem[]>([])
const unreadCount = ref(0)
const loading = ref(true)
const deleting = ref<number | null>(null)

const showForm = ref(false)

const form = ref<NoticeCreateParams>({
  title: '',
  content: '',
  priority: 0,
  is_todo: false,
  is_pinned: false,
})
const submitting = ref(false)

async function loadData() {
  loading.value = true
  try {
    const [noticeRes, countRes] = await Promise.all([
      getNotices(),
      getUnreadCount(),
    ])
    if (noticeRes.success) notices.value = noticeRes.notices || []
    if (countRes.success) unreadCount.value = countRes.count
  } catch (_) {}
  finally { loading.value = false }
}

onMounted(loadData)

function openForm() {
  form.value = { title: '', content: '', priority: 0, is_todo: false, is_pinned: false }
  showForm.value = true
}

async function handleCreate() {
  if (!form.value.title.trim()) {
    showToast('请输入通知标题')
    return
  }
  if (!form.value.content.trim()) {
    showToast('请输入通知内容')
    return
  }
  submitting.value = true
  try {
    const res = await createNotice(form.value)
    if (res.success) {
      showToast('通知发布成功')
      showForm.value = false
      await loadData()
    } else {
      showToast(res.message || '发布失败', 'error')
    }
  } catch (_) { showToast('发布失败', 'error') }
  finally { submitting.value = false }
}

async function handleDelete(id: number) {
  if (deleting.value === id) return
  deleting.value = id
  try {
    const res = await deleteNotice(id)
    if (res.success) {
      showToast('已删除')
      notices.value = notices.value.filter(n => n.id !== id)
    } else {
      showToast('删除失败', 'error')
    }
  } catch (_) { showToast('删除失败', 'error') }
  finally { deleting.value = null }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function priorityLabel(p: number) {
  if (p >= 2) return '紧急'
  if (p === 1) return '重要'
  return '普通'
}

function priorityClass(p: number) {
  if (p >= 2) return 'urgent'
  if (p === 1) return 'important'
  return 'normal'
}
</script>

<template>
  <div class="notice-admin-page">
    <NavBar title="通知管理" show-back />

    <!-- Unread badge -->
    <div class="unread-bar">
      <span class="unread-label">未读通知</span>
      <span class="unread-count">{{ unreadCount }}</span>
    </div>

    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="notices.length === 0" class="empty-state">暂无通知</div>

    <div
      v-for="item in notices"
      :key="item.id"
      class="notice-card"
    >
      <div class="card-left">
        <div class="priority-indicator" :class="priorityClass(item.priority)"></div>
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <span class="card-title">{{ item.title }}</span>
          <span class="read-badge" :class="{ unread: !item.is_read }">
            {{ item.is_read ? '已读' : '未读' }}
          </span>
        </div>
        <div class="card-content">{{ item.content?.replace(/<[^>]*>/g, '').slice(0, 120) || '' }}</div>
        <div class="card-meta">
          <span class="priority-tag" :class="priorityClass(item.priority)">{{ priorityLabel(item.priority) }}</span>
          <span>{{ item.creator_name || '' }}</span>
          <span>{{ formatDate(item.created_at) }}</span>
          <span v-if="item.is_todo" class="todo-tag">待办</span>
        </div>
      </div>
      <button
        v-if="canManageNotice"
        class="delete-btn"
        :disabled="deleting === item.id"
        @click="handleDelete(item.id)"
      >
        {{ deleting === item.id ? '…' : '删除' }}
      </button>
    </div>

    <!-- FAB 发布通知 -->
    <button v-if="canManageNotice" class="fab" @click="openForm">发布通知</button>

    <!-- 发布通知弹窗 -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="form-modal">
        <h3 class="form-title">发布通知</h3>

        <label class="form-field">
          <span class="field-label">标题</span>
          <input v-model="form.title" class="field-input" placeholder="请输入通知标题" />
        </label>

        <label class="form-field">
          <span class="field-label">内容</span>
          <textarea v-model="form.content" class="field-textarea" rows="4" placeholder="请输入通知内容"></textarea>
        </label>

        <label class="form-field">
          <span class="field-label">优先级</span>
          <select v-model="form.priority" class="field-input">
            <option :value="0">普通</option>
            <option :value="1">重要</option>
            <option :value="2">紧急</option>
          </select>
        </label>

        <label class="form-field form-field-row">
          <span class="field-label">标记为待办</span>
          <input v-model="form.is_todo" type="checkbox" class="field-checkbox" />
        </label>
        <label class="form-field form-field-row">
          <span class="field-label">📌 首页置顶</span>
          <input v-model="form.is_pinned" type="checkbox" class="field-checkbox" />
        </label>

        <div class="form-actions">
          <button class="btn-cancel" @click="showForm = false">取消</button>
          <button class="btn-submit" :disabled="submitting" @click="handleCreate">
            {{ submitting ? '发布中…' : '发布' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-admin-page {
  padding-bottom: 80px;
  min-height: 100vh;
  background: var(--color-bg);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

/* Unread bar */
.unread-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--color-accent-bg);
  margin: 8px 12px;
  border-radius: var(--radius-md);
}
.unread-label {
  font-size: 14px;
  color: var(--color-text-2);
}
.unread-count {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-accent);
}

/* Notice cards */
.notice-card {
  display: flex;
  align-items: stretch;
  margin: 0 12px 8px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: background 0.15s;
}
.notice-card:active {
  background: var(--color-surface-hover);
}

.card-left {
  display: flex;
  align-items: stretch;
  padding: 4px 0;
  flex-shrink: 0;
}

.priority-indicator {
  width: 3px;
  border-radius: 2px;
  margin: 0 6px;
}
.priority-indicator.normal { background: var(--color-accent); }
.priority-indicator.important { background: var(--color-warning); }
.priority-indicator.urgent { background: var(--color-error); }

.card-body {
  flex: 1;
  padding: 12px 0 12px 4px;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.read-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text-3);
  flex-shrink: 0;
}
.read-badge.unread {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 600;
}

.card-content {
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}

.card-meta {
  font-size: 11px;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.priority-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}
.priority-tag.normal { background: var(--color-accent-bg); color: var(--color-accent); }
.priority-tag.important { background: #fef3c7; color: #d97706; }
.priority-tag.urgent { background: var(--color-error-bg); color: var(--color-error); }
.todo-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #fef3c7;
  color: #d97706;
}

.delete-btn {
  flex-shrink: 0;
  width: 52px;
  border: none;
  background: transparent;
  color: var(--color-error);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.delete-btn:active {
  background: var(--color-error-bg);
}
.delete-btn:disabled {
  opacity: 0.5;
}

/* FAB */
.fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--color-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  z-index: 50;
  -webkit-tap-highlight-color: transparent;
}
.fab:active {
  transform: scale(0.92);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* Overlay / Modal */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.form-modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.form-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 20px;
  text-align: center;
}

.form-field {
  display: block;
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 6px;
}

.field-input,
.field-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.field-input:focus,
.field-textarea:focus {
  border-color: var(--color-accent);
}
.field-textarea {
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.form-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-field-row .field-label {
  margin-bottom: 0;
}
.field-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-accent);
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.form-actions button {
  flex: 1;
  height: 42px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.form-actions button:disabled {
  opacity: 0.5;
}
.btn-cancel {
  background: var(--color-surface-hover);
  color: var(--color-text-2);
}
.btn-submit {
  background: var(--color-accent);
  color: #fff;
}
</style>
