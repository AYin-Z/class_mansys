<script setup lang="ts">
/**
 * 心理倾诉（学员）
 *
 * 2026-09 体验修复：
 *  - 「我的记录」加载失败 → StateView 错误态 + 重试（原来 catch (_) {} 后显示「暂无记录」）；
 *  - 提交成功/失败都有反馈（原来两个 catch 都是空的，提交失败用户完全无感）；
 *  - 空态改成「标题 + 一句解释」，说明会有人跟进；
 *  - 状态标签换 BaseBadge，次要文字从 11px 提到 --font-size-xs。
 */
import { ref, onMounted } from 'vue'
import { submitPsychApplication, getMyPsychApplications, PSYCH_STATUS_LABEL } from '@/api/psychological'
import type { PsychApplication } from '@/api/psychological'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const content = ref('')
const applications = ref<PsychApplication[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const submitting = ref(false)

onMounted(async () => {
  await loadApplications()
})

async function loadApplications() {
  loading.value = true
  error.value = null
  try {
    const res = await getMyPsychApplications()
    if (res.success) applications.value = res.applications || []
  } catch (e) {
    error.value = e
    applications.value = []
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  const text = content.value.trim()
  if (!text) {
    showToast('请先写下你想说的内容', 'error')
    return
  }
  if (submitting.value) return

  submitting.value = true
  try {
    const res = await submitPsychApplication(text)
    if (res.success) {
      content.value = ''
      showToast('已提交，干部会尽快跟进', 'success')
      await loadApplications()
    }
  } catch (e) {
    toastIfNotNotified(e, '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

function statusVariant(status: number): 'warning' | 'info' | 'success' {
  if (status === 0) return 'warning'
  if (status === 2) return 'success'
  return 'info'
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
        <BaseButton
          variant="primary"
          :loading="submitting"
          :disabled="!content.trim()"
          @click="handleSubmit"
        >
          <AppIcon v-if="!submitting" name="send" :size="15" />
          提交
        </BaseButton>
      </div>
      <p class="submit-hint">内容仅干部可见，会有人跟进你的情况。</p>
    </div>

    <!-- History Section -->
    <div class="history-section">
      <div class="section-title">我的记录</div>

      <StateView
        :loading="loading"
        :error="error"
        :empty="applications.length === 0"
        loading-text="正在加载记录…"
        empty-icon="heart"
        empty-title="还没有倾诉记录"
        empty-description="提交后会在这里看到处理进度和回复"
        @retry="loadApplications"
      >
        <div
          v-for="item in applications"
          :key="item.id"
          class="history-card"
        >
          <div class="history-header">
            <span class="history-content">{{ item.content }}</span>
            <BaseBadge :variant="statusVariant(item.status)">
              {{ PSYCH_STATUS_LABEL[item.status] || '未知' }}
            </BaseBadge>
          </div>
          <div class="history-meta">
            <span>{{ formatTime(item.created_at) }}</span>
            <span v-if="item.handler_name">处理人: {{ item.handler_name }}</span>
          </div>
          <div v-if="item.handler_notes" class="handler-notes">
            {{ item.handler_notes }}
          </div>
        </div>
      </StateView>
    </div>
  </div>
</template>

<style scoped>
.psych-page {
  min-height: 100vh;
  background: var(--color-bg);
}

/* Section Title */
.section-title {
  font-size: var(--font-size-lg);
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-body);
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color var(--dur-fast);
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
  gap: 12px;
  margin-top: 8px;
}

.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
}

.submit-hint {
  margin-top: 8px;
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  line-height: 1.5;
}

/* History Section */
.history-section {
  padding: 0 16px 16px;
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
  font-size: var(--font-size-body);
  color: var(--color-text);
  line-height: 1.6;
  word-break: break-word;
}

.history-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.handler-notes {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  background: var(--color-surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin-top: 8px;
  line-height: 1.5;
}
</style>
