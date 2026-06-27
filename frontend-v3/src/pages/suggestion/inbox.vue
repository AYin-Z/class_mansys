<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getAllSuggestions, handleSuggestion, SUGGESTION_STATUS_LABEL } from '@/api/suggestion'
import type { SuggestionItem } from '@/api/suggestion'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const TABS = [
  { key: -1, label: '全部' },
  { key: 0, label: '待处理' },
  { key: 1, label: '处理中' },
  { key: 2, label: '已处理' },
] as const

const allSuggestions = ref<SuggestionItem[]>([])
const loading = ref(true)
const activeTab = ref(-1)
const expandedId = ref<number | null>(null)

// Handling form
const handlingId = ref<number | null>(null)
const formStatus = ref<0 | 1 | 2>(0)
const formNotes = ref('')
const submitting = ref(false)

const filteredSuggestions = computed(() => {
  if (activeTab.value === -1) return allSuggestions.value
  return allSuggestions.value.filter(s => s.status === activeTab.value)
})

const tabCounts = computed(() => {
  const counts: Record<number, number> = {}
  for (const t of TABS) {
    counts[t.key] = t.key === -1
      ? allSuggestions.value.length
      : allSuggestions.value.filter(s => s.status === t.key).length
  }
  return counts
})

async function fetchData() {
  loading.value = true
  try {
    const res = await getAllSuggestions()
    if (res.success) allSuggestions.value = res.suggestions || []
  } catch (_) {
    showToast('加载失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

function toggleExpand(item: SuggestionItem) {
  if (expandedId.value === item.id) {
    expandedId.value = null
    handlingId.value = null
    return
  }
  expandedId.value = item.id
  handlingId.value = item.id
  formStatus.value = item.status as 0 | 1 | 2
  formNotes.value = item.handler_notes || ''
}

async function submitHandle() {
  if (!handlingId.value) return
  submitting.value = true
  try {
    const res = await handleSuggestion(handlingId.value, {
      status: formStatus.value,
      handler_notes: formNotes.value || undefined,
    })
    if (res.success) {
      showToast('操作成功')
      const item = allSuggestions.value.find(s => s.id === handlingId.value)
      if (item) {
        item.status = formStatus.value
        item.handler_notes = formNotes.value
      }
      expandedId.value = null
      handlingId.value = null
    } else {
      showToast('操作失败', 'error')
    }
  } catch (_) {
    showToast('操作失败', 'error')
  } finally {
    submitting.value = false
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr.slice(0, 10)
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  general: '综合',
  life: '生活',
  study: '学习',
  activity: '活动',
  other: '其他',
}

function categoryLabel(cat: string) {
  return CATEGORY_LABEL[cat] || cat
}
</script>

<template>
  <div class="inbox-page">
    <NavBar title="建议箱" show-back />

    <!-- Tabs -->
    <div class="tabs">
      <div
        v-for="tab in TABS"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="tab-label">{{ tab.label }}</span>
        <span class="tab-badge" v-if="tabCounts[tab.key] > 0">{{ tabCounts[tab.key] }}</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- Empty -->
    <div v-else-if="filteredSuggestions.length === 0" class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">暂无建议</div>
    </div>

    <!-- Card List -->
    <div v-else class="card-list">
      <div
        v-for="item in filteredSuggestions"
        :key="item.id"
        class="card"
        :class="{ expanded: expandedId === item.id }"
      >
        <!-- Card Header (always visible) -->
        <div class="card-header" @click="toggleExpand(item)">
          <div class="card-content-preview">
            {{ item.content.length > 80 ? item.content.slice(0, 80) + '...' : item.content }}
          </div>
          <div class="card-meta">
            <span class="category-badge">{{ categoryLabel(item.category) }}</span>
            <span
              class="status-badge"
              :class="'status-' + item.status"
            >{{ SUGGESTION_STATUS_LABEL[item.status] }}</span>
            <span class="card-date">{{ formatDate(item.created_at) }}</span>
          </div>
        </div>

        <!-- Expanded Handler -->
        <div v-if="expandedId === item.id" class="card-body">
          <div class="full-content">{{ item.content }}</div>

          <div class="handler-section">
            <div class="form-group">
              <label class="form-label">处理状态</label>
              <select v-model="formStatus" class="form-select">
                <option :value="0">待处理</option>
                <option :value="1">处理中</option>
                <option :value="2">已处理</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">处理备注</label>
              <textarea
                v-model="formNotes"
                class="form-textarea"
                placeholder="输入处理备注（选填）"
                rows="3"
              ></textarea>
            </div>

            <button
              class="btn-submit"
              :disabled="submitting"
              @click="submitHandle"
            >
              {{ submitting ? '提交中...' : '提交处理' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inbox-page {
  padding-bottom: 80px;
  min-height: 100vh;
  background: var(--color-bg, #f5f5f5);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 64px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  color: var(--color-text-3);
}

/* Tabs */
.tabs {
  display: flex;
  background: var(--color-surface);
  padding: 8px 12px;
  gap: 6px;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 48px;
  z-index: 5;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 34px;
  border-radius: var(--radius-sm, 6px);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, color 0.15s;
}

.tab-item:active {
  background: var(--color-surface-hover);
}

.tab-item.active {
  background: var(--color-accent-bg, #e8f0fe);
  color: var(--color-accent, #1a73e8);
  font-weight: 600;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-bg, #f0f0f0);
  color: var(--color-text-3);
}

.tab-item.active .tab-badge {
  background: var(--color-accent, #1a73e8);
  color: #fff;
}

/* Cards */
.card-list {
  padding: 8px 12px;
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius-md, 10px);
  margin-bottom: 10px;
  box-shadow: var(--shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.card.expanded {
  box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.12));
}

.card-header {
  padding: 14px 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.card-header:active {
  background: var(--color-surface-hover);
}

.card-content-preview {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
  margin-bottom: 10px;
  word-break: break-word;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.category-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-accent-bg, #e8f0fe);
  color: var(--color-accent, #1a73e8);
  font-weight: 600;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.status-badge.status-0 {
  background: #fff3e0;
  color: #e65100;
}

.status-badge.status-1 {
  background: #e3f2fd;
  color: #1565c0;
}

.status-badge.status-2 {
  background: #e8f5e9;
  color: #2e7d32;
}

.card-date {
  margin-left: auto;
  color: var(--color-text-3);
}

/* Expanded Body */
.card-body {
  border-top: 1px solid var(--color-border);
  padding: 14px 16px;
}

.full-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--color-bg, #f9f9f9);
  border-radius: var(--radius-sm, 6px);
}

.handler-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
}

.form-select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface);
  font-size: 14px;
  color: var(--color-text);
  outline: none;
  appearance: auto;
}

.form-select:focus {
  border-color: var(--color-accent, #1a73e8);
}

.form-textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface);
  font-size: 14px;
  color: var(--color-text);
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.form-textarea:focus {
  border-color: var(--color-accent, #1a73e8);
}

.form-textarea::placeholder {
  color: var(--color-text-3);
}

.btn-submit {
  height: 42px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-accent, #1a73e8);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.btn-submit:active {
  opacity: 0.85;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
