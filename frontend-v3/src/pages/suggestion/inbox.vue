<script setup lang="ts">
/**
 * 建议箱（干部收件箱）
 *
 * 2026-09 体验修复：
 *  - 加载失败 → StateView 错误态 + 重试（原来 catch 里只弹一句提示，列表仍显示「暂无建议」）；
 *  - 筛选无结果用 filtered 空态，文案与真空态区分；
 *  - 处理失败走 toastIfNotNotified，不再用「操作失败」覆盖后端具体原因；成功给成功提示；
 *  - 状态标签用 BaseBadge + 令牌（原来 0/1/2 各有硬编码色，且与文案语义不一致）；
 *  - 标签页/提交按钮点击区提到 44px，底部避让交给 App.vue。
 */
import { ref, onMounted, computed } from 'vue'
import { getAllSuggestions, handleSuggestion, SUGGESTION_STATUS_LABEL } from '@/api/suggestion'
import type { SuggestionItem } from '@/api/suggestion'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import FormField from '@/components/ui/FormField.vue'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const TABS = [
  { key: -1, label: '全部' },
  { key: 0, label: '待处理' },
  { key: 1, label: '处理中' },
  { key: 2, label: '已处理' },
] as const

const allSuggestions = ref<SuggestionItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
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
  error.value = null
  try {
    const res = await getAllSuggestions()
    if (res.success) allSuggestions.value = res.suggestions || []
  } catch (e) {
    error.value = e
    allSuggestions.value = []
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

function statusVariant(status: number): 'warning' | 'info' | 'success' {
  if (status === 0) return 'warning'
  if (status === 2) return 'success'
  return 'info'
}

async function submitHandle() {
  if (!handlingId.value || submitting.value) return
  submitting.value = true
  try {
    const res = await handleSuggestion(handlingId.value, {
      status: formStatus.value,
      handler_notes: formNotes.value || undefined,
    })
    if (res.success) {
      showToast('处理结果已保存', 'success')
      const item = allSuggestions.value.find(s => s.id === handlingId.value)
      if (item) {
        item.status = formStatus.value
        item.handler_notes = formNotes.value
      }
      expandedId.value = null
      handlingId.value = null
    }
  } catch (e) {
    toastIfNotNotified(e, '保存失败，请重试')
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
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="tab-label">{{ tab.label }}</span>
        <span class="tab-badge" v-if="tabCounts[tab.key] > 0">{{ tabCounts[tab.key] }}</span>
      </button>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="filteredSuggestions.length === 0"
      loading-text="正在加载建议…"
      empty-icon="inbox"
      :empty-variant="activeTab === -1 ? 'default' : 'filtered'"
      :empty-title="activeTab === -1 ? '还没有收到建议' : '当前筛选条件下没有建议'"
      :empty-description="activeTab === -1 ? '学员提交建议后会出现在这里' : '点上方「全部」查看其他状态的建议'"
      @retry="fetchData"
    >
      <div class="card-list">
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
              <BaseBadge variant="info">{{ categoryLabel(item.category) }}</BaseBadge>
              <BaseBadge :variant="statusVariant(item.status)">
                {{ SUGGESTION_STATUS_LABEL[item.status] || '未知' }}
              </BaseBadge>
              <span class="card-date">{{ formatDate(item.created_at) }}</span>
            </div>
          </div>

          <!-- Expanded Handler -->
          <div v-if="expandedId === item.id" class="card-body">
            <div class="full-content">{{ item.content }}</div>

            <div class="handler-section">
              <FormField label="处理状态">
                <select v-model="formStatus">
                  <option :value="0">待处理</option>
                  <option :value="1">处理中</option>
                  <option :value="2">已处理</option>
                </select>
              </FormField>

              <FormField label="处理备注" hint="备注会回显给提交建议的学员">
                <textarea
                  v-model="formNotes"
                  placeholder="输入处理备注（选填）"
                  rows="3"
                ></textarea>
              </FormField>

              <BaseButton
                variant="primary"
                block
                :loading="submitting"
                @click="submitHandle"
              >提交处理</BaseButton>
            </div>
          </div>
        </div>
      </div>
    </StateView>
  </div>
</template>

<style scoped>
.inbox-page {
  min-height: 100vh;
  background: var(--color-bg);
}

/* Tabs */
.tabs {
  display: flex;
  background: var(--color-surface);
  padding: 8px 12px;
  gap: 6px;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: var(--navbar-h);
  z-index: var(--z-navbar);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-2);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--dur-fast), color var(--dur-fast);
}

.tab-item:active {
  background: var(--color-surface-hover);
}

.tab-item.active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 600;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-2xs);
  font-weight: 600;
  background: var(--color-surface-2);
  color: var(--color-text-2);
}

.tab-item.active .tab-badge {
  background: var(--color-accent);
  color: #fff;
}

/* Cards */
.card-list {
  padding: 8px 12px;
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: box-shadow var(--dur-base);
}

.card.expanded {
  box-shadow: var(--shadow-card-hover);
}

.card-header {
  padding: 14px 16px;
  min-height: 44px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.card-header:active {
  background: var(--color-surface-hover);
}

.card-content-preview {
  font-size: var(--font-size-body);
  line-height: 1.5;
  color: var(--color-text);
  margin-bottom: 10px;
  word-break: break-word;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-xs);
}

.card-date {
  margin-left: auto;
  color: var(--color-text-2);
}

/* Expanded Body */
.card-body {
  border-top: 1px solid var(--color-border);
  padding: 14px 16px;
}

.full-content {
  font-size: var(--font-size-body);
  line-height: 1.6;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--color-surface-2);
  border-radius: var(--radius-sm);
}

.handler-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
