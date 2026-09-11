<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/ui/NavBar.vue'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/ui'
import { getAllPsychApplications, handlePsychApplication, PSYCH_STATUS_LABEL } from '@/api/psychological'
import type { PsychApplication } from '@/api/psychological'

/**
 * 心理申请处理（干部）
 * 审计修复：后端早就有 /all 与 /handle 接口，但前端没有任何处理入口，
 * 学员提交后只能停在「待处理」，handler_notes 永远为空。
 */
const router = useRouter()
const userStore = useUserStore()
const canHandle = computed(() => userStore.hasPermission('HANDLE_PSYCHOLOGICAL'))

const TABS = [
  { key: -1, label: '全部' },
  { key: 0, label: '待处理' },
  { key: 1, label: '处理中' },
  { key: 2, label: '已完成' }
] as const

const applications = ref<PsychApplication[]>([])
const loading = ref(true)
const activeTab = ref<number>(-1)
const expandedId = ref<number | null>(null)
const handlingId = ref<number | null>(null)
const formStatus = ref<0 | 1 | 2>(1)
const formNotes = ref('')
const submitting = ref(false)

const filtered = computed(() => (activeTab.value === -1 ? applications.value : applications.value.filter((a) => a.status === activeTab.value)))
const tabCounts = computed(() => {
  const counts: Record<number, number> = {}
  for (const t of TABS) {
    counts[t.key] = t.key === -1 ? applications.value.length : applications.value.filter((a) => a.status === t.key).length
  }
  return counts
})

async function load() {
  loading.value = true
  try {
    const res = await getAllPsychApplications({})
    if (res?.success) applications.value = res.applications || []
  } catch (e: any) {
    showToast(e?.message || '加载心理申请失败', 'error')
  } finally {
    loading.value = false
  }
}

function openHandle(item: PsychApplication) {
  handlingId.value = item.id
  formStatus.value = (item.status === 0 ? 1 : (item.status as 1 | 2))
  formNotes.value = item.handler_notes || ''
}

async function submitHandle() {
  if (!handlingId.value) return
  if (formStatus.value === 2 && !formNotes.value.trim()) {
    showToast('标记完成前请填写处理说明', 'error')
    return
  }
  submitting.value = true
  try {
    await handlePsychApplication(handlingId.value, { status: formStatus.value, handler_notes: formNotes.value.trim() })
    showToast('已更新')
    handlingId.value = null
    await load()
  } catch (e: any) {
    showToast(e?.message || '更新失败', 'error')
  } finally {
    submitting.value = false
  }
}

function fmt(v?: string | null) {
  return v ? String(v).replace('T', ' ').slice(0, 16) : '—'
}

onMounted(() => {
  if (!canHandle.value) {
    showToast('无权处理心理申请', 'error')
    router.replace('/pages/index/index')
    return
  }
  load()
})
</script>

<template>
  <div class="psych-manage">
    <NavBar title="心理申请处理" show-back />

    <div class="tabs">
      <span v-for="t in TABS" :key="t.key" :class="['tab', { active: activeTab === t.key }]" @click="activeTab = t.key">
        {{ t.label }}<b v-if="tabCounts[t.key]"> {{ tabCounts[t.key] }}</b>
      </span>
    </div>

    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="!filtered.length" class="state">暂无申请</div>

    <div v-for="item in filtered" :key="item.id" class="card">
      <div class="card-head" @click="expandedId = expandedId === item.id ? null : item.id">
        <div class="who">
          <b>{{ item.user_name || ('用户 #' + item.user_id) }}</b>
          <span class="sid">{{ item.student_id || '' }}</span>
        </div>
        <span :class="['status', 's' + item.status]">{{ PSYCH_STATUS_LABEL[item.status] || item.status }}</span>
      </div>
      <div class="meta">提交于 {{ fmt(item.created_at) }}</div>

      <p v-if="expandedId === item.id" class="content">{{ item.content }}</p>
      <p v-else class="content clamp">{{ item.content }}</p>

      <div v-if="item.handler_notes" class="notes">处理说明：{{ item.handler_notes }}</div>

      <div class="actions">
        <button class="btn-sm" @click="openHandle(item)">更新处理状态</button>
      </div>
    </div>

    <div v-if="handlingId" class="mask" @click.self="handlingId = null">
      <div class="modal">
        <h3>更新处理状态</h3>
        <label>状态
          <select v-model.number="formStatus">
            <option :value="0">待处理</option>
            <option :value="1">处理中</option>
            <option :value="2">已完成</option>
          </select>
        </label>
        <label>处理说明（学员可见）
          <textarea v-model="formNotes" rows="3" placeholder="例如：已电话沟通，约定周五面谈"></textarea>
        </label>
        <div class="modal-actions">
          <button class="btn-sm" @click="handlingId = null">取消</button>
          <button class="btn-primary" :disabled="submitting" @click="submitHandle">{{ submitting ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.psych-manage { min-height: 100vh; background: var(--color-bg); padding-bottom: 80px; }
.tabs { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; }
.tab {
  font-size: 13px; padding: 6px 12px; border-radius: 999px; white-space: nowrap; cursor: pointer;
  background: var(--color-surface); color: var(--color-text-2); border: 1px solid var(--color-border);
}
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); border-color: var(--color-accent); }
.card { background: var(--color-surface); border-radius: var(--radius-md, 12px); margin: 0 16px 12px; padding: 14px; }
.card-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.who b { font-size: 14px; color: var(--color-text); }
.sid { font-size: 12px; color: var(--color-text-3); margin-left: 6px; }
.status { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-hover); color: var(--color-text-3); }
.status.s0 { background: rgba(255,170,0,.15); color: var(--color-warning); }
.status.s1 { background: var(--color-accent-bg); color: var(--color-accent); }
.status.s2 { background: rgba(46,160,67,.12); color: #2ea043; }
.meta { font-size: 11px; color: var(--color-text-3); margin: 4px 0 8px; }
.content { font-size: 14px; line-height: 1.7; color: var(--color-text-2); white-space: pre-wrap; margin: 0 0 8px; }
.content.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.notes { font-size: 12px; color: var(--color-accent); background: var(--color-accent-bg); padding: 8px 10px; border-radius: 8px; margin-bottom: 8px; }
.actions { display: flex; justify-content: flex-end; }
.state { text-align: center; color: var(--color-text-3); font-size: 13px; padding: 24px; }
.btn-sm, .btn-primary { cursor: pointer; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-2); font-size: 12px; padding: 6px 12px; }
.btn-primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
.modal { width: 100%; max-width: 420px; background: var(--color-surface); border-radius: var(--radius-md, 12px); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.modal h3 { margin: 0; font-size: 16px; color: var(--color-text); }
.modal label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--color-text-3); }
.modal select, .modal textarea { font-size: 13px; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-family: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
