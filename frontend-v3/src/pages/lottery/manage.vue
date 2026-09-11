<script setup lang="ts">
/**
 * 抽奖管理
 *
 * 2026-09（体验修复）：
 *  - 三态（loading / error+retry / empty）：catch (_) {} 不再把失败吞成「暂无抽奖」
 *  - 悬浮「+」上移避开 TabBar（bottom: calc(var(--tabbar-h) + 16px) + z-index: var(--z-fab)）
 *  - 创建 / 开奖弹窗改用 BaseModal + FormField + BaseButton（提交中禁用防重复开奖）
 *  - 「结束抽奖」确认写清对象与后果，并加在途锁（此前可连点）
 *  - emoji ▾▸ → AppIcon；#dcfce7/#16a34a → 语义令牌
 */
import { ref, onMounted } from 'vue'
import {
  getLotteries, createLottery, getLotteryDetail,
  drawLottery, closeLottery,
} from '@/api/lottery'
import { toastIfNotNotified } from '@/utils/request'
import type { LotteryItem, LotteryParticipant } from '@/api/lottery'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'

const lotteries = ref<LotteryItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const showForm = ref(false)
const expandedId = ref<number | null>(null)
const expandedParticipants = ref<LotteryParticipant[]>([])
const expandedError = ref<unknown>(null)
const expanding = ref(false)

// Create form
const form = ref({ name: '', description: '', rules: '', start_time: '', end_time: '' })
const formErrors = ref<{ name?: string; rules?: string; time?: string }>({})
const submitting = ref(false)

// Draw form
const showDrawForm = ref(false)
const drawCount = ref(1)
const prizeName = ref('')
const drawError = ref('')
const drawing = ref(false)
const closingId = ref<number | null>(null)
const latestWinners = ref<number[]>([])

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await getLotteries()
    if (res.success) lotteries.value = res.lotteries || []
    else error.value = new Error('加载抽奖列表失败，请稍后重试')
  } catch (e) {
    error.value = e
  }
  finally { loading.value = false }
}

onMounted(loadData)

function openForm() {
  form.value = { name: '', description: '', rules: '', start_time: '', end_time: '' }
  formErrors.value = {}
  showForm.value = true
}

async function handleCreate() {
  if (submitting.value) return
  const errs: { name?: string; rules?: string; time?: string } = {}
  if (!form.value.name.trim()) errs.name = '请输入名称'
  if (!form.value.rules.trim()) errs.rules = '请输入规则'
  if (!form.value.start_time || !form.value.end_time) errs.time = '请选择起止时间'
  else if (new Date(form.value.end_time) <= new Date(form.value.start_time)) errs.time = '结束时间必须晚于开始时间'
  formErrors.value = errs
  if (errs.name || errs.rules || errs.time) return

  submitting.value = true
  try {
    const res = await createLottery(form.value)
    if (res.success) {
      showToast('抽奖创建成功', 'success')
      showForm.value = false
      await loadData()
    } else {
      showToast('创建失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '创建失败，请稍后重试') }
  finally { submitting.value = false }
}

/** 拉取展开面板的参与者（开奖后刷新用，不折叠面板） */
async function loadExpand(id: number) {
  expanding.value = true
  expandedError.value = null
  try {
    const res = await getLotteryDetail(id)
    if (res.success) expandedParticipants.value = res.participants || []
    else expandedError.value = new Error('加载参与者失败，请稍后重试')
  } catch (e) {
    expandedError.value = e
  }
  finally { expanding.value = false }
}

async function toggleExpand(id: number) {
  if (expandedId.value === id) { expandedId.value = null; return }
  expandedId.value = id
  expandedParticipants.value = []
  latestWinners.value = []
  await loadExpand(id)
}

function openDrawForm(lottery: LotteryItem) {
  drawCount.value = 1
  prizeName.value = ''
  drawError.value = ''
  latestWinners.value = []
  showDrawForm.value = true
  void lottery
}

async function handleDraw() {
  if (drawing.value) return
  const total = expandedParticipants.value.length
  if (drawCount.value < 1) { drawError.value = '中奖人数至少为 1'; return }
  if (total > 0 && drawCount.value > total) { drawError.value = `中奖人数不能超过参与人数（${total}）`; return }
  drawError.value = ''
  drawing.value = true
  try {
    const res = await drawLottery(expandedId.value!, {
      winner_count: drawCount.value,
      prize: prizeName.value.trim() || undefined,
    })
    if (res.success) {
      latestWinners.value = res.winner_participant_ids || []
      showToast(`已抽出 ${latestWinners.value.length} 名中奖者`, 'success')
      showDrawForm.value = false
      if (expandedId.value) await loadExpand(expandedId.value)
      await loadData()
    } else {
      showToast('抽奖失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '抽奖失败，请稍后重试') }
  finally { drawing.value = false }
}

async function handleClose(lottery: LotteryItem) {
  if (closingId.value !== null) return
  const ok = await showConfirm('结束抽奖', `《${lottery.name}》`, {
    danger: true,
    confirmText: '结束抽奖',
    hint: '结束后无法再参与和开奖，已产生的中奖名单保留',
  })
  if (!ok) return
  closingId.value = lottery.id
  try {
    const res = await closeLottery(lottery.id)
    if (res.success) {
      showToast('已结束抽奖', 'success')
      lotteries.value = lotteries.value.map(l => l.id === lottery.id ? { ...l, is_active: false } : l)
    } else {
      showToast('结束失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '结束失败，请稍后重试') }
  finally { closingId.value = null }
}

function statusLabel(l: LotteryItem) {
  const now = Date.now()
  if (!l.is_active) return '已结束'
  if (now < new Date(l.start_time).getTime()) return '未开始'
  if (now > new Date(l.end_time).getTime()) return '可开奖'
  return '进行中'
}
function statusClass(l: LotteryItem) {
  const s = statusLabel(l)
  return { '未开始': 'pending', '进行中': 'active', '可开奖': 'ready', '已结束': 'ended' }[s] || 'ended'
}
function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="manage-page">
    <NavBar title="抽奖管理" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="lotteries.length === 0"
      loading-text="正在加载抽奖…"
      empty-icon="gift"
      empty-title="还没有抽奖活动"
      empty-description="点右下角「+」创建第一个抽奖"
      @retry="loadData"
    >
      <div v-for="l in lotteries" :key="l.id" class="card-group">
        <div class="card" @click="toggleExpand(l.id)">
          <div class="card-body">
            <div class="card-title">{{ l.name }}</div>
            <div class="card-desc">{{ l.description?.slice(0, 60) || '无描述' }}</div>
            <div class="card-meta">
              <span :class="['tag', statusClass(l)]">{{ statusLabel(l) }}</span>
              <span>{{ l.participant_count || 0 }} 人参与</span>
              <span v-if="l.winner_count">{{ l.winner_count }} 人获奖</span>
            </div>
          </div>
          <AppIcon
            class="expand-icon"
            :name="expandedId === l.id ? 'chevron-down' : 'chevron-right'"
            :size="18"
          />
        </div>

        <div v-if="expandedId === l.id" class="expand-panel">
          <StateView slim :loading="expanding" :error="expandedError" @retry="loadExpand(l.id)">
            <div class="detail-row">
              <span class="detail-label">规则</span>
              <span>{{ l.rules }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">时间</span>
              <span>{{ formatDate(l.start_time) }} ~ {{ formatDate(l.end_time) }}</span>
            </div>

            <!-- 参与者 -->
            <div v-if="expandedParticipants.length" class="section">
              <div class="section-title">参与者 ({{ expandedParticipants.length }})</div>
              <div class="participant-grid">
                <span v-for="p in expandedParticipants" :key="p.id"
                  class="p-name" :class="{ winner: p.is_winner }">
                  {{ p.user_name }}
                </span>
              </div>
            </div>
            <div v-else class="section">
              <div class="section-title">暂无参与者</div>
            </div>

            <!-- 操作按钮 -->
            <div class="action-row">
              <button
                v-if="l.is_active && statusLabel(l) === '可开奖'"
                class="action-btn primary" @click.stop="openDrawForm(l)">
                开奖
              </button>
              <button
                v-if="l.is_active"
                class="action-btn danger"
                :disabled="closingId === l.id"
                @click.stop="handleClose(l)">
                {{ closingId === l.id ? '处理中…' : '结束抽奖' }}
              </button>
            </div>
          </StateView>
        </div>
      </div>
    </StateView>

    <button class="fab" type="button" aria-label="创建抽奖" @click="openForm">
      <AppIcon name="plus" :size="24" />
    </button>

    <!-- 创建弹窗 -->
    <BaseModal v-model="showForm" title="创建抽奖" :close-on-overlay="false">
      <FormField label="名称" required :error="formErrors.name">
        <input v-model="form.name" class="field-input" placeholder="如 月度之星抽奖" />
      </FormField>
      <FormField label="描述（选填）">
        <input v-model="form.description" class="field-input" placeholder="抽奖描述" />
      </FormField>
      <FormField label="规则说明" required :error="formErrors.rules">
        <textarea v-model="form.rules" class="field-input" rows="2" placeholder="如 全员参与、现场抽取"></textarea>
      </FormField>
      <FormField label="起止时间" required :error="formErrors.time">
        <div class="form-row">
          <input v-model="form.start_time" type="datetime-local" class="field-input" />
          <input v-model="form.end_time" type="datetime-local" class="field-input" />
        </div>
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" @click="showForm = false">取消</BaseButton>
        <BaseButton :loading="submitting" @click="handleCreate">创建</BaseButton>
      </template>
    </BaseModal>

    <!-- 开奖弹窗 -->
    <BaseModal v-model="showDrawForm" title="开奖" :close-on-overlay="false">
      <FormField
        label="中奖人数"
        required
        :error="drawError"
        :hint="`当前参与人数 ${expandedParticipants.length}`"
      >
        <input
          v-model.number="drawCount"
          type="number"
          min="1"
          class="field-input"
          :max="Math.max(1, expandedParticipants.length)"
        />
      </FormField>
      <FormField label="奖品名称（选填）">
        <input v-model="prizeName" class="field-input" placeholder="如 文具礼包" />
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" @click="showDrawForm = false">取消</BaseButton>
        <BaseButton variant="danger" :loading="drawing" @click="handleDraw">开始抽奖</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.manage-page { min-height: 100vh; background: var(--color-bg); }

.card-group { margin: 8px 12px; }
.card {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card); cursor: pointer;
  margin-bottom: 4px;
}
.card:active { background: var(--color-surface-hover); }
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.card-desc { font-size: var(--font-size-sm); color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tag { font-size: var(--font-size-xs); font-weight: 600; padding: 1px 6px; border-radius: var(--radius-sm); }
.tag.active { background: var(--color-success-bg); color: var(--color-success); }
.tag.pending { background: var(--color-accent-bg); color: var(--color-accent); }
.tag.ready { background: var(--color-warning-bg); color: var(--color-warning); }
.tag.ended { background: var(--color-surface-hover); color: var(--color-text-3); }
.expand-icon { color: var(--color-text-3); flex-shrink: 0; }

.expand-panel {
  margin: 0 0 8px; padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
}
.detail-row { display: flex; gap: 8px; font-size: var(--font-size-sm); color: var(--color-text-2); margin-bottom: 6px; }
.detail-label { color: var(--color-text-3); flex-shrink: 0; min-width: 36px; }
.section { margin-bottom: 12px; }
.section-title { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-2); margin-bottom: 6px; }
.participant-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.p-name {
  font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--radius-sm);
  background: var(--color-bg); color: var(--color-text-2);
}
.p-name.winner { background: var(--color-success-bg); color: var(--color-success); font-weight: 600; }
.action-row { display: flex; gap: 8px; margin-top: 4px; }
.action-btn {
  flex: 1; min-height: 44px; padding: 8px; border: none; border-radius: var(--radius-sm);
  font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; font-family: inherit;
}
.action-btn.primary { background: var(--color-accent); color: #fff; }
.action-btn.danger { background: var(--color-error-bg); color: var(--color-error); }
.action-btn:disabled { opacity: 0.55; cursor: not-allowed; }

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
textarea.field-input { resize: vertical; }
.form-row { display: flex; gap: 8px; }
</style>
