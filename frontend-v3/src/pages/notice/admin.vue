<script setup lang="ts">
/**
 * 通知管理（干部）
 *
 * 2026-09 体验修复：
 *  - 加载失败 → StateView 错误态 + 重试（原来 catch (_) {} 后显示「暂无通知」）；
 *  - 删除通知加二次确认，文案写明后果（学员端立即不可见且不可恢复）；
 *  - 发布表单从手写遮罩弹窗换成 BaseModal + FormField，去掉了 3 处 rgba 遮罩/阴影硬编码；
 *  - 删除/发布按钮 loading 防重复提交；失败提示走 toastIfNotNotified，不覆盖后端原因；
 *  - 优先级/待办/已读角标用 BaseBadge，emoji 换成 AppIcon。
 */
import { ref, onMounted, computed } from 'vue'
import { getNotices, getUnreadCount, createNotice, deleteNotice } from '@/api/notice'
import type { NoticeItem, NoticeCreateParams } from '@/api/notice'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
// 发布/删除通知需要 MANAGE_NOTICE 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canManageNotice = computed(() => userStore.hasPermission('MANAGE_NOTICE'))

const notices = ref<NoticeItem[]>([])
const unreadCount = ref(0)
const loading = ref(true)
const error = ref<unknown>(null)
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
  error.value = null
  try {
    const [noticeRes, countRes] = await Promise.all([
      getNotices(),
      getUnreadCount(),
    ])
    if (noticeRes.success) notices.value = noticeRes.notices || []
    if (countRes.success) unreadCount.value = countRes.count
  } catch (e) {
    error.value = e
    notices.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function openForm() {
  form.value = { title: '', content: '', priority: 0, is_todo: false, is_pinned: false }
  showForm.value = true
}

async function handleCreate() {
  if (submitting.value) return
  if (!form.value.title.trim()) {
    showToast('请输入通知标题', 'error')
    return
  }
  if (!form.value.content.trim()) {
    showToast('请输入通知内容', 'error')
    return
  }
  submitting.value = true
  try {
    const res = await createNotice(form.value)
    if (res.success) {
      showToast('通知发布成功', 'success')
      showForm.value = false
      await loadData()
    }
  } catch (e) {
    toastIfNotNotified(e, '发布失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(item: NoticeItem) {
  if (deleting.value === item.id) return
  const ok = await showConfirm('删除通知', `《${item.title}》`, {
    confirmText: '删除',
    danger: true,
    hint: '删除后学员端立即不可见，且无法恢复。',
  })
  if (!ok) return
  deleting.value = item.id
  try {
    const res = await deleteNotice(item.id)
    if (res.success) {
      showToast('通知已删除', 'success')
      notices.value = notices.value.filter(n => n.id !== item.id)
    } else {
      showToast('删除失败，请重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '删除失败，请重试')
  } finally {
    deleting.value = null
  }
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

function priorityVariant(p: number): 'danger' | 'warning' | 'info' {
  if (p >= 2) return 'danger'
  if (p === 1) return 'warning'
  return 'info'
}
</script>

<template>
  <div class="notice-admin-page">
    <NavBar title="通知管理" show-back />

    <!-- Unread badge -->
    <div class="unread-bar">
      <AppIcon name="bell" :size="16" />
      <span class="unread-label">未读通知</span>
      <span class="unread-count">{{ unreadCount }}</span>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="notices.length === 0"
      loading-text="正在加载通知…"
      empty-icon="bell"
      empty-title="还没有发布过通知"
      empty-description="发布后学员端会立即收到提醒，重要事项可标记为待办"
      :empty-action-text="canManageNotice ? '发布通知' : ''"
      @retry="loadData"
      @empty-action="openForm"
    >
      <div
        v-for="item in notices"
        :key="item.id"
        class="notice-card"
      >
        <div class="card-body">
          <div class="card-title-row">
            <span class="card-title">{{ item.title }}</span>
            <BaseBadge :variant="item.is_read ? 'default' : 'info'">
              {{ item.is_read ? '已读' : '未读' }}
            </BaseBadge>
          </div>
          <div class="card-content">{{ item.content?.replace(/<[^>]*>/g, '').slice(0, 120) || '' }}</div>
          <div class="card-meta">
            <BaseBadge :variant="priorityVariant(item.priority)">
              {{ priorityLabel(item.priority) }}
            </BaseBadge>
            <BaseBadge v-if="item.is_todo" variant="warning">
              <AppIcon name="clipboard" :size="11" />
              待办
            </BaseBadge>
            <span>{{ item.creator_name || '' }}</span>
            <span>{{ formatDate(item.created_at) }}</span>
          </div>
        </div>
        <button
          v-if="canManageNotice"
          class="delete-btn"
          type="button"
          :disabled="deleting === item.id"
          :aria-label="`删除通知：${item.title}`"
          @click="handleDelete(item)"
        >
          <AppIcon v-if="deleting !== item.id" name="trash" :size="17" />
          <span v-else class="dot-loading" aria-hidden="true" />
        </button>
      </div>
    </StateView>

    <!-- FAB 发布通知 -->
    <button
      v-if="canManageNotice"
      class="fab"
      type="button"
      aria-label="发布通知"
      @click="openForm"
    >
      <AppIcon name="plus" :size="24" />
    </button>

    <!-- 发布通知弹窗 -->
    <BaseModal v-model="showForm" title="发布通知" :close-on-overlay="false">
      <div class="form">
        <FormField label="标题" required>
          <input v-model="form.title" placeholder="请输入通知标题" />
        </FormField>

        <FormField label="内容" required>
          <textarea v-model="form.content" rows="4" placeholder="请输入通知内容"></textarea>
        </FormField>

        <FormField label="优先级">
          <select v-model="form.priority">
            <option :value="0">普通</option>
            <option :value="1">重要</option>
            <option :value="2">紧急</option>
          </select>
        </FormField>

        <label class="check-row">
          <span class="check-label">标记为待办</span>
          <input v-model="form.is_todo" type="checkbox" class="field-checkbox" />
        </label>
        <label class="check-row">
          <span class="check-label">首页置顶</span>
          <input v-model="form.is_pinned" type="checkbox" class="field-checkbox" />
        </label>
        <p class="form-hint">标记为待办后，学员需在通知详情里点「标记完成」。</p>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="showForm = false">取消</BaseButton>
        <BaseButton :loading="submitting" @click="handleCreate">发布</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.notice-admin-page {
  min-height: 100vh;
  background: var(--color-bg);
}

/* Unread bar */
.unread-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  margin: 8px 12px;
  border-radius: var(--radius-md);
}
.unread-label {
  font-size: var(--font-size-body);
  color: var(--color-text-2);
}
.unread-count {
  font-size: var(--font-size-title);
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
  transition: background var(--dur-fast);
}
.notice-card:active {
  background: var(--color-surface-hover);
}

.card-body {
  flex: 1;
  padding: 12px 0 12px 14px;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.card-title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-content {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}

.card-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.delete-btn {
  flex-shrink: 0;
  width: 52px;
  min-height: 44px;
  border: none;
  background: transparent;
  color: var(--color-error);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.delete-btn:active {
  background: var(--color-error-bg);
}
.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dot-loading {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: dot-spin 0.7s linear infinite;
}
@keyframes dot-spin { to { transform: rotate(360deg); } }

/* FAB */
.fab {
  position: fixed;
  bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--color-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lift);
  cursor: pointer;
  transition: transform var(--dur-fast), box-shadow var(--dur-fast);
  z-index: var(--z-fab);
  -webkit-tap-highlight-color: transparent;
}
.fab:active {
  transform: scale(0.92);
}

/* 弹窗内表单 */
.form { display: flex; flex-direction: column; gap: 14px; }
.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
}
.check-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-2);
}
.field-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--color-accent);
}
.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  line-height: 1.5;
}
</style>
