<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getLotteries, createLottery, getLotteryDetail,
  drawLottery, closeLottery,
} from '@/api/lottery'
import type { LotteryItem, LotteryParticipant } from '@/api/lottery'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast, showConfirm } from '@/utils/ui'

const lotteries = ref<LotteryItem[]>([])
const loading = ref(true)
const showForm = ref(false)
const expandedId = ref<number | null>(null)
const expandedParticipants = ref<LotteryParticipant[]>([])
const expanding = ref(false)

// Create form
const form = ref({ name: '', description: '', rules: '', start_time: '', end_time: '' })
const submitting = ref(false)

// Draw form
const showDrawForm = ref(false)
const drawCount = ref(1)
const prizeName = ref('')
const drawing = ref(false)
const latestWinners = ref<number[]>([])

async function loadData() {
  loading.value = true
  try {
    const res = await getLotteries()
    if (res.success) lotteries.value = res.lotteries || []
  } catch (_) {}
  finally { loading.value = false }
}

onMounted(loadData)

function openForm() {
  form.value = { name: '', description: '', rules: '', start_time: '', end_time: '' }
  showForm.value = true
}

async function handleCreate() {
  if (!form.value.name.trim()) { showToast('请输入名称'); return }
  if (!form.value.rules.trim()) { showToast('请输入规则'); return }
  if (!form.value.start_time || !form.value.end_time) { showToast('请选择起止时间'); return }
  if (new Date(form.value.end_time) <= new Date(form.value.start_time)) {
    showToast('结束时间必须晚于开始时间'); return
  }
  submitting.value = true
  try {
    const res = await createLottery(form.value)
    if (res.success) {
      showToast('抽奖创建成功')
      showForm.value = false
      await loadData()
    }
  } catch (e: any) { showToast(e.message || '创建失败', 'error') }
  finally { submitting.value = false }
}

async function toggleExpand(id: number) {
  if (expandedId.value === id) { expandedId.value = null; return }
  expandedId.value = id
  expanding.value = true
  expandedParticipants.value = []
  latestWinners.value = []
  try {
    const res = await getLotteryDetail(id)
    if (res.success) expandedParticipants.value = res.participants || []
  } catch (_) {}
  finally { expanding.value = false }
}

function openDrawForm(lottery: LotteryItem) {
  const total = lottery.participant_count || expandedParticipants.value.length
  drawCount.value = Math.min(1, total)
  prizeName.value = ''
  latestWinners.value = []
  showDrawForm.value = true
}

async function handleDraw() {
  if (drawCount.value < 1) { showToast('中奖人数至少为 1'); return }
  drawing.value = true
  try {
    const res = await drawLottery(expandedId.value!, {
      winner_count: drawCount.value,
      prize: prizeName.value.trim() || undefined,
    })
    if (res.success) {
      latestWinners.value = res.winner_participant_ids || []
      showToast(`已抽出 ${latestWinners.value.length} 名中奖者`)
      showDrawForm.value = false
      if (expandedId.value) await toggleExpand(expandedId.value)
      await loadData()
    }
  } catch (e: any) { showToast(e.message || '抽奖失败', 'error') }
  finally { drawing.value = false }
}

async function handleClose(id: number) {
  const ok = await showConfirm('结束抽奖', '结束后无法再参与和开奖，确认？')
  if (!ok) return
  try {
    const res = await closeLottery(id)
    if (res.success) {
      showToast('已结束')
      lotteries.value = lotteries.value.map(l => l.id === id ? { ...l, is_active: false } : l)
    }
  } catch (e: any) { showToast(e.message || '操作失败', 'error') }
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

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="lotteries.length === 0" class="state">暂无抽奖</div>

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
        <span class="expand-icon">{{ expandedId === l.id ? '▾' : '▸' }}</span>
      </div>

      <div v-if="expandedId === l.id && !expanding" class="expand-panel">
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
            class="action-btn danger" @click.stop="handleClose(l.id)">
            结束抽奖
          </button>
        </div>
      </div>
    </div>

    <button class="fab" @click="openForm">创建抽奖</button>

    <!-- 创建弹窗 -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h3 class="modal-title">创建抽奖</h3>
        <label class="form-field">
          <span class="field-label">名称</span>
          <input v-model="form.name" class="field-input" placeholder="如 月度之星抽奖" />
        </label>
        <label class="form-field">
          <span class="field-label">描述（选填）</span>
          <input v-model="form.description" class="field-input" placeholder="抽奖描述" />
        </label>
        <label class="form-field">
          <span class="field-label">规则说明</span>
          <textarea v-model="form.rules" class="field-input" rows="2" placeholder="如 全员参与、现场抽取" style="resize:vertical"></textarea>
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
        <div class="form-actions">
          <button class="btn-cancel" @click="showForm = false">取消</button>
          <button class="btn-submit" :disabled="submitting" @click="handleCreate">
            {{ submitting ? '创建中…' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 开奖弹窗 -->
    <div v-if="showDrawForm" class="overlay" @click.self="showDrawForm = false">
      <div class="modal">
        <h3 class="modal-title">开奖</h3>
        <label class="form-field">
          <span class="field-label">中奖人数</span>
          <input v-model.number="drawCount" type="number" min="1" class="field-input" :max="expandedParticipants.length" />
        </label>
        <label class="form-field">
          <span class="field-label">奖品名称（选填）</span>
          <input v-model="prizeName" class="field-input" placeholder="如 文具礼包" />
        </label>
        <div class="form-actions">
          <button class="btn-cancel" @click="showDrawForm = false">取消</button>
          <button class="btn-submit" :disabled="drawing" @click="handleDraw">
            {{ drawing ? '抽取中…' : '开始抽奖' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

.card-group { margin: 0 12px 4px; }
.card {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card); cursor: pointer;
  margin-bottom: 4px;
}
.card:active { background: var(--color-surface-hover); }
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.card-desc { font-size: 13px; color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 11px; color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; align-items: center; }
.tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.tag.active { background: #dcfce7; color: #16a34a; }
.tag.pending { background: var(--color-accent-bg); color: var(--color-accent); }
.tag.ready { background: var(--color-warning-bg); color: var(--color-warning); }
.tag.ended { background: var(--color-surface-hover); color: var(--color-text-3); }
.expand-icon { font-size: 16px; color: var(--color-text-3); flex-shrink: 0; }

.expand-panel {
  margin: 0 0 8px; padding: 12px 14px; border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
}
.detail-row { display: flex; gap: 8px; font-size: 13px; color: var(--color-text-2); margin-bottom: 6px; }
.detail-label { color: var(--color-text-3); flex-shrink: 0; min-width: 36px; }
.section { margin-bottom: 12px; }
.section-title { font-size: 12px; font-weight: 600; color: var(--color-text-2); margin-bottom: 6px; }
.participant-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.p-name {
  font-size: 12px; padding: 2px 8px; border-radius: var(--radius-sm);
  background: var(--color-bg); color: var(--color-text-2);
}
.p-name.winner { background: #dcfce7; color: #16a34a; font-weight: 600; }
.action-row { display: flex; gap: 8px; margin-top: 4px; }
.action-btn {
  flex: 1; padding: 8px; border: none; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.action-btn.primary { background: var(--color-accent); color: #fff; }
.action-btn.danger { background: var(--color-error-bg); color: var(--color-error); }

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
.form-actions { display: flex; gap: 10px; margin-top: 20px; }
.form-actions button {
  flex: 1; height: 42px; border: none; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-cancel { background: var(--color-surface-hover); color: var(--color-text-2); }
.btn-submit { background: var(--color-accent); color: #fff; }
.btn-submit:disabled { opacity: 0.5; }
</style>
