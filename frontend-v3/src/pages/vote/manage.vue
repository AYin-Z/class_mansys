<script setup lang="ts">
/**
 * 投票管理
 *
 * 2026-09（体验修复）：
 *  - 三态（loading / error+retry / empty）：catch (_) {} 不再把失败吞成「暂无投票」
 *  - 悬浮「+」上移避开 TabBar（bottom: calc(var(--tabbar-h) + 16px) + z-index: var(--z-fab)）
 *  - 创建弹窗改用 BaseModal + FormField（字段级错误），提交中禁用防重复创建
 *  - 「关闭投票」确认写清对象与后果；emoji（✕ +）→ AppIcon；硬编码色值 → 令牌
 */
import { ref, onMounted } from 'vue'
import { getVotes, createVote, closeVote, getVoteStatus } from '@/api/vote'
import { toastIfNotNotified } from '@/utils/request'
import type { VoteItem } from '@/api/vote'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'

const votes = ref<VoteItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const showForm = ref(false)
const options = ref<string[]>(['', ''])
const optionsError = ref('')
const submitting = ref(false)
const closing = ref<number | null>(null)

const form = ref({
  title: '',
  description: '',
  type: 'single' as 'single' | 'multiple',
  start_time: '',
  end_time: '',
})
const formErrors = ref<{ title?: string; time?: string }>({})

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await getVotes()
    if (res.success) votes.value = res.votes || []
    else error.value = new Error('加载投票列表失败，请稍后重试')
  } catch (e) {
    error.value = e
  }
  finally { loading.value = false }
}

onMounted(loadData)

function openForm() {
  form.value = { title: '', description: '', type: 'single', start_time: '', end_time: '' }
  options.value = ['', '']
  formErrors.value = {}
  optionsError.value = ''
  showForm.value = true
}

function addOption() {
  if (options.value.length >= 10) { showToast('最多 10 个选项', 'error'); return }
  options.value.push('')
}

function removeOption(idx: number) {
  if (options.value.length <= 2) { showToast('至少 2 个选项', 'error'); return }
  options.value.splice(idx, 1)
}

async function handleCreate() {
  if (submitting.value) return
  const errs: { title?: string; time?: string } = {}
  if (!form.value.title.trim()) errs.title = '请输入标题'
  if (!form.value.start_time || !form.value.end_time) errs.time = '请选择起止时间'
  else if (new Date(form.value.end_time) <= new Date(form.value.start_time)) errs.time = '结束时间必须晚于开始时间'
  const validOptions = options.value.map(o => o.trim()).filter(Boolean)
  formErrors.value = errs
  optionsError.value = validOptions.length < 2 ? '至少 2 个有效选项' : ''
  if (errs.title || errs.time || optionsError.value) return

  submitting.value = true
  try {
    const res = await createVote({
      ...form.value,
      options: validOptions,
    })
    if (res.success) {
      showToast('投票创建成功', 'success')
      showForm.value = false
      await loadData()
    } else {
      showToast('创建失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '创建失败，请稍后重试') }
  finally { submitting.value = false }
}

async function handleClose(v: VoteItem) {
  if (closing.value !== null) return
  const ok = await showConfirm('关闭投票', `《${v.title}》`, {
    danger: true,
    confirmText: '关闭投票',
    hint: '关闭后所有人不能再投票，已投的票数仍保留在结果里',
  })
  if (!ok) return
  closing.value = v.id
  try {
    const res = await closeVote(v.id)
    if (res.success) {
      showToast('已关闭投票', 'success')
      votes.value = votes.value.map(item => item.id === v.id ? { ...item, is_active: false } : item)
    } else {
      showToast('关闭失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '关闭失败，请稍后重试') }
  finally { closing.value = null }
}

function statusLabel(v: VoteItem) {
  const s = getVoteStatus(v)
  return { pending: '未开始', active: '进行中', ended: '已结束' }[s]
}
function statusClass(v: VoteItem) {
  const s = getVoteStatus(v)
  return { pending: 'pending', active: 'active', ended: 'ended' }[s]
}
function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="manage-page">
    <NavBar title="投票管理" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="votes.length === 0"
      loading-text="正在加载投票…"
      empty-icon="check-circle"
      empty-title="还没有投票"
      empty-description="点右下角「+」创建第一个投票"
      @retry="loadData"
    >
      <div v-for="v in votes" :key="v.id" class="card">
        <div class="card-body">
          <div class="card-title">{{ v.title }}</div>
          <div class="card-desc">{{ v.description?.slice(0, 80) || '无描述' }}</div>
          <div class="card-meta">
            <span :class="['tag', statusClass(v)]">{{ statusLabel(v) }}</span>
            <span>{{ v.type === 'single' ? '单选' : '多选' }}</span>
            <span>{{ v.participant_count || 0 }} 人参与</span>
            <span>{{ formatDate(v.start_time) }} ~ {{ formatDate(v.end_time) }}</span>
          </div>
        </div>
        <button
          v-if="v.is_active"
          class="close-btn"
          :disabled="closing === v.id"
          @click="handleClose(v)"
        >
          {{ closing === v.id ? '处理中…' : '关闭' }}
        </button>
      </div>
    </StateView>

    <button class="fab" type="button" aria-label="创建投票" @click="openForm">
      <AppIcon name="plus" :size="24" />
    </button>

    <!-- 创建弹窗 -->
    <BaseModal v-model="showForm" title="创建投票" :close-on-overlay="false">
      <FormField label="标题" required :error="formErrors.title">
        <input v-model="form.title" class="field-input" placeholder="投票标题" />
      </FormField>

      <FormField label="描述（选填）">
        <input v-model="form.description" class="field-input" placeholder="投票描述" />
      </FormField>

      <FormField label="类型">
        <select v-model="form.type" class="field-input">
          <option value="single">单选</option>
          <option value="multiple">多选</option>
        </select>
      </FormField>

      <FormField label="起止时间" required :error="formErrors.time">
        <div class="form-row">
          <input v-model="form.start_time" type="datetime-local" class="field-input" />
          <input v-model="form.end_time" type="datetime-local" class="field-input" />
        </div>
      </FormField>

      <FormField label="选项" required :error="optionsError">
        <div v-for="(opt, i) in options" :key="i" class="option-row">
          <input v-model="options[i]" class="field-input" :placeholder="'选项 ' + (i + 1)" />
          <button
            v-if="options.length > 2"
            class="option-del"
            type="button"
            :aria-label="`删除选项 ${i + 1}`"
            @click="removeOption(i)"
          >
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        <button class="option-add" type="button" @click="addOption">
          <AppIcon name="plus" :size="14" />
          <span>添加选项</span>
        </button>
      </FormField>

      <template #footer>
        <BaseButton variant="secondary" @click="showForm = false">取消</BaseButton>
        <BaseButton :loading="submitting" @click="handleCreate">创建</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.manage-page { min-height: 100vh; background: var(--color-bg); }

.card {
  display: flex; align-items: center; gap: 8px;
  margin: 8px 12px; padding: 12px 14px;
  border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-card);
}
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.card-desc { font-size: var(--font-size-sm); color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.tag { font-size: var(--font-size-xs); font-weight: 600; padding: 1px 6px; border-radius: var(--radius-sm); }
.tag.active { background: var(--color-success-bg); color: var(--color-success); }
.tag.pending { background: var(--color-accent-bg); color: var(--color-accent); }
.tag.ended { background: var(--color-surface-hover); color: var(--color-text-3); }
.close-btn {
  flex-shrink: 0; min-height: 44px; padding: 6px 14px;
  border: 1px solid var(--color-error); border-radius: var(--radius-sm);
  background: transparent; color: var(--color-error); font-size: var(--font-size-sm);
  font-weight: 600; cursor: pointer; font-family: inherit;
}
.close-btn:disabled { opacity: 0.5; }

/* 悬浮「+」：上移避开 TabBar */
.fab {
  position: fixed; bottom: calc(var(--tabbar-h) + 16px); right: 24px;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--color-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-lift); cursor: pointer; z-index: var(--z-fab);
}
.fab:active { opacity: 0.9; }

.field-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--font-size-body); color: var(--color-text);
  background: var(--color-surface); outline: none; box-sizing: border-box;
  font-family: inherit;
}
.field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
.form-row { display: flex; gap: 8px; }
.option-row { display: flex; gap: 6px; margin-bottom: 6px; }
.option-row .field-input { flex: 1; }
.option-del {
  width: 44px; min-height: 44px; border: none; background: transparent;
  color: var(--color-text-3); cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.option-add {
  width: 100%; min-height: 44px; padding: 8px; border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm); background: transparent; color: var(--color-accent);
  font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 4px;
}
</style>
