<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  submitSuggestion,
  getMineSuggestions,
} from '@/api/suggestion'
import type { SuggestionItem } from '@/api/suggestion'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const loading = ref(true)
const submitting = ref(false)

// Form
const content = ref('')
const category = ref('')

// My submissions
const suggestions = ref<SuggestionItem[]>([])

const CATEGORY_OPTIONS = [
  { value: '', label: '请选择分类（选填）' },
  { value: 'general', label: '综合' },
  { value: 'life', label: '生活' },
  { value: 'study', label: '学习' },
  { value: 'activity', label: '活动' },
  { value: 'other', label: '其他' },
]

const CATEGORY_LABEL: Record<string, string> = {
  general: '综合',
  life: '生活',
  study: '学习',
  activity: '活动',
  other: '其他',
}

function categoryLabel(cat: string): string {
  return CATEGORY_LABEL[cat] || cat
}

const STATUS_LABEL: Record<number, string> = {
  0: '待处理',
  1: '已处理',
}

onMounted(async () => {
  try {
    const res = await getMineSuggestions()
    if (res.success) suggestions.value = res.suggestions || []
  } catch (_) {
    /* ignore */
  } finally {
    loading.value = false
  }
})

async function handleSubmit() {
  const trimmed = content.value.trim()
  if (!trimmed) {
    showToast('请输入建议内容', 'error')
    return
  }
  submitting.value = true
  try {
    const res = await submitSuggestion({
      content: trimmed,
      category: category.value || undefined,
    })
    if (res.success) {
      showToast('提交成功')
      content.value = ''
      category.value = ''
      // Refresh list
      const refreshed = await getMineSuggestions()
      if (refreshed.success) suggestions.value = refreshed.suggestions || []
    } else {
      showToast(res.message || '提交失败', 'error')
    }
  } catch (_) {
    showToast('提交失败', 'error')
  } finally {
    submitting.value = false
  }
}

function formatDate(dateStr: string): string {
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
</script>

<template>
  <div class="suggestion-page">
    <NavBar title="建议箱" />

    <!-- 提交表单 -->
    <div class="form-section">
      <div class="form-title">提交建议</div>
      <textarea
        v-model="content"
        class="form-textarea"
        placeholder="请写下你的建议..."
        rows="4"
      ></textarea>
      <select v-model="category" class="form-select">
        <option
          v-for="opt in CATEGORY_OPTIONS"
          :key="opt.value"
          :value="opt.value"
        >{{ opt.label }}</option>
      </select>
      <button
        class="btn-submit"
        :disabled="submitting || !content.trim()"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : '提交建议' }}
      </button>
    </div>

    <!-- 我的提交 -->
    <div class="section">
      <div class="section-title">我的提交</div>

      <div v-if="loading" class="state-text">加载中...</div>
      <div v-else-if="suggestions.length === 0" class="state-text empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">暂无提交记录</div>
      </div>

      <div v-else class="card-list">
        <div
          v-for="item in suggestions"
          :key="item.id"
          class="card"
        >
          <div class="card-content">{{ item.content }}</div>
          <div class="card-meta">
            <span class="category-badge" v-if="item.category">{{ categoryLabel(item.category) }}</span>
            <span
              class="status-badge"
              :class="'status-' + item.status"
            >{{ STATUS_LABEL[item.status] || '未知' }}</span>
            <span class="card-reply" v-if="item.handler_notes">
              回复：{{ item.handler_notes }}
            </span>
            <span class="card-date">{{ formatDate(item.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.suggestion-page {
  padding-bottom: 80px;
  min-height: 100vh;
  background: var(--color-bg, #f5f5f5);
}

.state-text {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

/* Form Section */
.form-section {
  margin: 12px;
  padding: 20px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
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

/* Section */
.section {
  margin: 0 12px 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  padding: 12px 0 8px;
}

/* Cards */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}

.card-content {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.5;
  margin-bottom: 10px;
  word-break: break-word;
  white-space: pre-wrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  flex-wrap: wrap;
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
  background: #e8f5e9;
  color: #2e7d32;
}

.card-reply {
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.card-date {
  margin-left: auto;
  color: var(--color-text-3);
  flex-shrink: 0;
}
</style>
