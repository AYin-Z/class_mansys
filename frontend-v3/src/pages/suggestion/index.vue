<script setup lang="ts">
/**
 * 建议箱（学员）
 *
 * 2026-09 体验修复：
 *  - 「我的提交」加载失败 → StateView 错误态 + 重试（原来 catch (_) {} 后显示空态）；
 *  - 空态改成「标题 + 一句解释」（说明匿名与回复机制），不再是零信息的「暂无提交记录」；
 *  - 提交成功给成功提示，失败走 toastIfNotNotified，不再用「提交失败」覆盖后端原因；
 *  - 状态/分类标签用 BaseBadge + 设计令牌（原来 #fff3e0/#e65100 等硬编码，且 1/2 号状态色与文案不符）；
 *  - 提交按钮换 BaseButton（loading 防重复提交），底部避让交给 App.vue。
 */
import { ref, onMounted } from 'vue'
import {
  submitSuggestion,
  getMineSuggestions,
  SUGGESTION_STATUS_LABEL,
} from '@/api/suggestion'
import type { SuggestionItem } from '@/api/suggestion'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const loading = ref(true)
const error = ref<unknown>(null)
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

// 状态：0 待处理 / 1 处理中 / 2 已处理（与后端一致）
function statusVariant(status: number): 'warning' | 'info' | 'success' {
  if (status === 0) return 'warning'
  if (status === 2) return 'success'
  return 'info'
}

async function loadMine() {
  loading.value = true
  error.value = null
  try {
    const res = await getMineSuggestions()
    if (res.success) suggestions.value = res.suggestions || []
  } catch (e) {
    error.value = e
    suggestions.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadMine)

async function handleSubmit() {
  const trimmed = content.value.trim()
  if (!trimmed) {
    showToast('请输入建议内容', 'error')
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const res = await submitSuggestion({
      content: trimmed,
      category: category.value || undefined,
    })
    if (res.success) {
      showToast('提交成功，可在下方查看处理进度', 'success')
      content.value = ''
      category.value = ''
      await loadMine()
    }
  } catch (e) {
    toastIfNotNotified(e, '提交失败，请重试')
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
      <BaseButton
        variant="primary"
        block
        :loading="submitting"
        :disabled="!content.trim()"
        @click="handleSubmit"
      >
        提交建议
      </BaseButton>
      <p class="form-hint">建议匿名提交，干部处理后会在这里回复你。</p>
    </div>

    <!-- 我的提交 -->
    <div class="section">
      <div class="section-title">我的提交</div>

      <StateView
        :loading="loading"
        :error="error"
        :empty="suggestions.length === 0"
        loading-text="正在加载提交记录…"
        empty-icon="message-circle"
        empty-title="还没有提交过建议"
        empty-description="建议是匿名送达的，干部处理后会在这里回复你"
        @retry="loadMine"
      >
        <div class="card-list">
          <div
            v-for="item in suggestions"
            :key="item.id"
            class="card"
          >
            <div class="card-content">{{ item.content }}</div>
            <div class="card-meta">
              <BaseBadge v-if="item.category" variant="info">{{ categoryLabel(item.category) }}</BaseBadge>
              <BaseBadge :variant="statusVariant(item.status)">
                {{ SUGGESTION_STATUS_LABEL[item.status] || '未知' }}
              </BaseBadge>
              <span class="card-date">{{ formatDate(item.created_at) }}</span>
            </div>
            <div v-if="item.handler_notes" class="card-reply">回复：{{ item.handler_notes }}</div>
          </div>
        </div>
      </StateView>
    </div>
  </div>
</template>

<style scoped>
.suggestion-page {
  min-height: 100vh;
  background: var(--color-bg);
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
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.form-textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--font-size-body);
  color: var(--color-text);
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.form-textarea:focus {
  border-color: var(--color-accent);
}

.form-textarea::placeholder {
  color: var(--color-text-3);
}

.form-select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--font-size-body);
  color: var(--color-text);
  outline: none;
  appearance: auto;
}

.form-select:focus {
  border-color: var(--color-accent);
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  line-height: 1.5;
}

/* Section */
.section {
  margin: 0 12px 16px;
}

.section-title {
  font-size: var(--font-size-md);
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
  font-size: var(--font-size-body);
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
  font-size: var(--font-size-xs);
  flex-wrap: wrap;
}

.card-reply {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-text-2);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  word-break: break-word;
}

.card-date {
  margin-left: auto;
  color: var(--color-text-2);
  flex-shrink: 0;
}
</style>
