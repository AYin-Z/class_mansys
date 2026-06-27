<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { submitPsychApplication, getMyPsychApplications, PSYCH_STATUS_LABEL } from '@/api/psychological'
import type { PsychApplication } from '@/api/psychological'
import NavBar from '@/components/ui/NavBar.vue'

const content = ref('')
const applications = ref<PsychApplication[]>([])
const loading = ref(true)
const submitting = ref(false)

onMounted(async () => {
  await loadApplications()
})

async function loadApplications() {
  try {
    const res = await getMyPsychApplications()
    if (res.success) applications.value = res.applications || []
  } catch (_) {
    /* ignore */
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  const text = content.value.trim()
  if (!text || submitting.value) return

  submitting.value = true
  try {
    const res = await submitPsychApplication(text)
    if (res.success) {
      content.value = ''
      await loadApplications()
    }
  } catch (_) {
    /* ignore */
  } finally {
    submitting.value = false
  }
}

function statusClass(status: number): string {
  if (status === 0) return 'status-pending'
  if (status === 1) return 'status-processing'
  return 'status-done'
}

function formatTime(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}/${day} ${h}:${min}`
}
</script>

<template>
  <div class="psych-page">
    <NavBar title="心理" />

    <!-- Submit Section -->
    <div class="submit-section">
      <div class="section-title">倾诉心声</div>
      <textarea
        v-model="content"
        class="psych-textarea"
        placeholder="在这里写下你想表达的内容..."
        rows="4"
        maxlength="1000"
      ></textarea>
      <div class="submit-row">
        <span class="char-count">{{ content.length }}/1000</span>
        <button
          class="submit-btn"
          :disabled="!content.trim() || submitting"
          @click="handleSubmit"
        >
          {{ submitting ? '提交中...' : '提交' }}
        </button>
      </div>
    </div>

    <!-- History Section -->
    <div class="history-section">
      <div class="section-title">我的记录</div>

      <div v-if="loading" class="state-text">加载中...</div>
      <div v-else-if="applications.length === 0" class="state-text">暂无记录</div>

      <div
        v-for="item in applications"
        :key="item.id"
        class="history-card"
      >
        <div class="history-header">
          <span class="history-content">{{ item.content }}</span>
          <span class="status-badge" :class="statusClass(item.status)">
            {{ PSYCH_STATUS_LABEL[item.status] || '未知' }}
          </span>
        </div>
        <div class="history-meta">
          <span>{{ formatTime(item.created_at) }}</span>
          <span v-if="item.handler_name">处理人: {{ item.handler_name }}</span>
        </div>
        <div v-if="item.handler_notes" class="handler-notes">
          {{ item.handler_notes }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.psych-page {
  padding-bottom: 24px;
}

.state-text {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

/* Section Title */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

/* Submit Section */
.submit-section {
  padding: 16px;
}

.psych-textarea {
  width: 100%;
  padding: 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.psych-textarea:focus {
  border-color: var(--color-accent);
}

.psych-textarea::placeholder {
  color: var(--color-text-3);
}

.submit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.char-count {
  font-size: 12px;
  color: var(--color-text-3);
}

.submit-btn {
  height: 38px;
  padding: 0 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.submit-btn:not(:disabled):active {
  opacity: 0.8;
}

/* History Section */
.history-section {
  padding: 0 16px;
}

.history-card {
  background: var(--color-surface);
  margin-bottom: 10px;
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}

.history-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.history-content {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.6;
  word-break: break-word;
}

.status-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.status-pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status-processing {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.status-done {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.history-meta {
  font-size: 11px;
  color: var(--color-text-3);
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.handler-notes {
  font-size: 13px;
  color: var(--color-text-2);
  background: var(--color-surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin-top: 8px;
  line-height: 1.5;
}
</style>
