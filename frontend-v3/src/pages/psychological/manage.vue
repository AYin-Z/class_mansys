<script setup lang="ts">
/**
 * 心理申请处理（干部）
 *
 * 2026-09 体验修复：
 *  - 加载失败 → StateView 错误态 + 重试（原来只弹一句 toast，列表仍显示「暂无申请」）；
 *  - 处理弹窗从手写遮罩（rgba + z-index:60）换成 BaseModal + FormField；
 *  - 失败提示走 toastIfNotNotified，成功给成功提示；保存中禁用按钮防重复提交；
 *  - 状态色从 rgba(255,170,0,.15)/#2ea043 换成语义令牌；
 *  - 删除底部 80px 手写避让（App.vue 已统一预留）。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import FormField from '@/components/ui/FormField.vue'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
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
const error = ref<unknown>(null)
const activeTab = ref<number>(-1)
const expandedId = ref<number | null>(null)
const handlingId = ref<number | null>(null)
/** BaseModal 需要 boolean，这里把「正在处理哪一条」映射成开关 */
const showHandle = computed({
  get: () => handlingId.value !== null,
  set: (v: boolean) => { if (!v) handlingId.value = null },
})
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
  error.value = null
  try {
    const res = await getAllPsychApplications({})
    if (res?.success) applications.value = res.applications || []
  } catch (e) {
    error.value = e
    applications.value = []
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
  if (!handlingId.value || submitting.value) return
  if (formStatus.value === 2 && !formNotes.value.trim()) {
    showToast('标记完成前请填写处理说明', 'error')
    return
  }
  submitting.value = true
  try {
    await handlePsychApplication(handlingId.value, { status: formStatus.value, handler_notes: formNotes.value.trim() })
    showToast('处理结果已更新', 'success')
    handlingId.value = null
    await load()
  } catch (e) {
    toastIfNotNotified(e, '更新失败，请重试')
  } finally {
    submitting.value = false
  }
}

function statusVariant(status: number): 'warning' | 'info' | 'success' {
  if (status === 0) return 'warning'
  if (status === 2) return 'success'
  return 'info'
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
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        :class="['tab', { active: activeTab === t.key }]"
        @click="activeTab = t.key"
      >
        {{ t.label }}<b v-if="tabCounts[t.key]"> {{ tabCounts[t.key] }}</b>
      </button>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="filtered.length === 0"
      loading-text="正在加载心理申请…"
      empty-icon="heart"
      :empty-variant="activeTab === -1 ? 'default' : 'filtered'"
      :empty-title="activeTab === -1 ? '还没有收到心理申请' : '当前筛选条件下没有申请'"
      :empty-description="activeTab === -1 ? '学员提交倾诉后会出现在这里' : '点上方「全部」查看其他状态的申请'"
      @retry="load"
    >
      <div v-for="item in filtered" :key="item.id" class="card">
        <div class="card-head" @click="expandedId = expandedId === item.id ? null : item.id">
          <div class="who">
            <b>{{ item.user_name || ('用户 #' + item.user_id) }}</b>
            <span class="sid">{{ item.student_id || '' }}</span>
          </div>
          <BaseBadge :variant="statusVariant(item.status)">
            {{ PSYCH_STATUS_LABEL[item.status] || item.status }}
          </BaseBadge>
        </div>
        <div class="meta">提交于 {{ fmt(item.created_at) }}</div>

        <p v-if="expandedId === item.id" class="content">{{ item.content }}</p>
        <p v-else class="content clamp">{{ item.content }}</p>

        <div v-if="item.handler_notes" class="notes">处理说明：{{ item.handler_notes }}</div>

        <div class="actions">
          <BaseButton variant="secondary" @click="openHandle(item)">更新处理状态</BaseButton>
        </div>
      </div>
    </StateView>

    <BaseModal v-model="showHandle" title="更新处理状态" :close-on-overlay="false">
      <div class="form">
        <FormField label="状态">
          <select v-model.number="formStatus">
            <option :value="0">待处理</option>
            <option :value="1">处理中</option>
            <option :value="2">已完成</option>
          </select>
        </FormField>
        <FormField label="处理说明（学员可见）" hint="标记为「已完成」时必须填写">
          <textarea v-model="formNotes" rows="3" placeholder="例如：已电话沟通，约定周五面谈"></textarea>
        </FormField>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="handlingId = null">取消</BaseButton>
        <BaseButton :loading="submitting" @click="submitHandle">保存</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.psych-manage { min-height: 100vh; background: var(--color-bg); }
.tabs { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; }
.tab {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-2);
  font-size: var(--font-size-sm);
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); border-color: var(--color-accent); }
.card { background: var(--color-surface); border-radius: var(--radius-md); margin: 0 16px 12px; padding: 14px; box-shadow: var(--shadow-card); }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; cursor: pointer; }
.who b { font-size: var(--font-size-body); color: var(--color-text); }
.sid { font-size: var(--font-size-xs); color: var(--color-text-2); margin-left: 6px; }
.meta { font-size: var(--font-size-xs); color: var(--color-text-2); margin: 4px 0 8px; }
.content { font-size: var(--font-size-body); line-height: 1.7; color: var(--color-text-2); white-space: pre-wrap; margin: 0 0 8px; }
.content.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.notes { font-size: var(--font-size-sm); color: var(--color-accent); background: var(--color-accent-bg); padding: 8px 10px; border-radius: var(--radius-sm); margin-bottom: 8px; }
.actions { display: flex; justify-content: flex-end; }

.form { display: flex; flex-direction: column; gap: 14px; }
</style>
