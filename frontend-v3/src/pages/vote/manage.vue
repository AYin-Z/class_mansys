<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getVotes, createVote, closeVote, getVoteStatus } from '@/api/vote'
import type { VoteItem } from '@/api/vote'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast, showConfirm } from '@/utils/ui'

const votes = ref<VoteItem[]>([])
const loading = ref(true)
const showForm = ref(false)
const options = ref<string[]>(['', ''])
const submitting = ref(false)
const closing = ref<number | null>(null)

const form = ref({
  title: '',
  description: '',
  type: 'single' as 'single' | 'multiple',
  start_time: '',
  end_time: '',
})

async function loadData() {
  loading.value = true
  try {
    const res = await getVotes()
    if (res.success) votes.value = res.votes || []
  } catch (_) {}
  finally { loading.value = false }
}

onMounted(loadData)

function openForm() {
  form.value = { title: '', description: '', type: 'single', start_time: '', end_time: '' }
  options.value = ['', '']
  showForm.value = true
}

function addOption() {
  if (options.value.length >= 10) { showToast('最多 10 个选项'); return }
  options.value.push('')
}

function removeOption(idx: number) {
  if (options.value.length <= 2) { showToast('至少 2 个选项'); return }
  options.value.splice(idx, 1)
}

async function handleCreate() {
  if (!form.value.title.trim()) { showToast('请输入标题'); return }
  const validOptions = options.value.map(o => o.trim()).filter(Boolean)
  if (validOptions.length < 2) { showToast('至少 2 个有效选项'); return }
  if (!form.value.start_time || !form.value.end_time) { showToast('请选择起止时间'); return }
  if (new Date(form.value.end_time) <= new Date(form.value.start_time)) {
    showToast('结束时间必须晚于开始时间'); return
  }
  submitting.value = true
  try {
    const res = await createVote({
      ...form.value,
      options: validOptions,
    })
    if (res.success) {
      showToast('投票创建成功')
      showForm.value = false
      await loadData()
    }
  } catch (e: any) { showToast(e.message || '创建失败', 'error') }
  finally { submitting.value = false }
}

async function handleClose(id: number) {
  const ok = await showConfirm('关闭投票', '关闭后无法再投票，确认？')
  if (!ok) return
  closing.value = id
  try {
    const res = await closeVote(id)
    if (res.success) {
      showToast('已关闭')
      votes.value = votes.value.map(v => v.id === id ? { ...v, is_active: false } : v)
    }
  } catch (e: any) { showToast(e.message || '操作失败', 'error') }
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

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="votes.length === 0" class="state">暂无投票</div>

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
        @click="handleClose(v.id)"
      >
        {{ closing === v.id ? '…' : '关闭' }}
      </button>
    </div>

    <button class="fab" @click="openForm">创建投票</button>

    <!-- 创建弹窗 -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h3 class="modal-title">创建投票</h3>

        <label class="form-field">
          <span class="field-label">标题</span>
          <input v-model="form.title" class="field-input" placeholder="投票标题" />
        </label>

        <label class="form-field">
          <span class="field-label">描述（选填）</span>
          <input v-model="form.description" class="field-input" placeholder="投票描述" />
        </label>

        <label class="form-field">
          <span class="field-label">类型</span>
          <select v-model="form.type" class="field-input">
            <option value="single">单选</option>
            <option value="multiple">多选</option>
          </select>
        </label>

        <div class="form-row">
          <label class="form-field" style="flex:1">
            <span class="field-label">开始时间</span>
            <input v-model="form.start_time" type="datetime-local" class="field-input" />
          </label>
          <label class="form-field" style="flex:1">
            <span class="field-label">结束时间</span>
            <input v-model="form.end_time" type="datetime-local" class="field-input" />
          </label>
        </div>

        <div class="form-field">
          <span class="field-label">选项</span>
          <div v-for="(opt, i) in options" :key="i" class="option-row">
            <input v-model="options[i]" class="field-input" :placeholder="'选项 ' + (i + 1)" />
            <button v-if="options.length > 2" class="option-del" @click="removeOption(i)">✕</button>
          </div>
          <button class="option-add" @click="addOption">+ 添加选项</button>
        </div>

        <div class="form-actions">
          <button class="btn-cancel" @click="showForm = false">取消</button>
          <button class="btn-submit" :disabled="submitting" @click="handleCreate">
            {{ submitting ? '创建中…' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

.card {
  display: flex; align-items: center; gap: 8px;
  margin: 8px 12px; padding: 12px 14px;
  border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-card);
}
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.card-desc { font-size: 13px; color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 11px; color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.tag.active { background: #dcfce7; color: #16a34a; }
.tag.pending { background: var(--color-accent-bg); color: var(--color-accent); }
.tag.ended { background: var(--color-surface-hover); color: var(--color-text-3); }
.close-btn {
  flex-shrink: 0; padding: 4px 12px; border: 1px solid var(--color-error); border-radius: var(--radius-sm);
  background: transparent; color: var(--color-error); font-size: 12px; font-weight: 600; cursor: pointer;
}
.close-btn:disabled { opacity: 0.5; }

.fab {
  position: fixed; bottom: 24px; right: 24px;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; z-index: 50;
}

.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  overflow-y: auto;
}
.modal {
  background: var(--color-surface); border-radius: var(--radius-lg); padding: 24px;
  width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  max-height: 90vh; overflow-y: auto;
}
.modal-title { font-size: 18px; font-weight: 700; color: var(--color-text); margin-bottom: 20px; text-align: center; }
.form-field { display: block; margin-bottom: 16px; }
.field-label { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-2); margin-bottom: 6px; }
.field-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text);
  background: var(--color-bg); outline: none; box-sizing: border-box;
}
.field-input:focus { border-color: var(--color-accent); }
.form-row { display: flex; gap: 8px; }
.option-row { display: flex; gap: 6px; margin-bottom: 6px; }
.option-row .field-input { flex: 1; }
.option-del {
  width: 32px; height: 40px; border: none; background: transparent;
  color: var(--color-text-3); font-size: 16px; cursor: pointer; flex-shrink: 0;
}
.option-add {
  width: 100%; padding: 8px; border: 1px dashed var(--color-border); border-radius: var(--radius-sm);
  background: transparent; color: var(--color-accent); font-size: 13px; cursor: pointer;
}
.form-actions { display: flex; gap: 10px; margin-top: 20px; }
.form-actions button {
  flex: 1; height: 42px; border: none; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-cancel { background: var(--color-surface-hover); color: var(--color-text-2); }
.btn-submit { background: var(--color-accent); color: #fff; }
.btn-submit:disabled { opacity: 0.5; }
</style>
