<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { applyLeave } from '@/api/leave'
import { uploadFile } from '@/utils/request'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const router = useRouter()
const leaveType = ref('')
const leaveReason = ref('')
const reasonDetail = ref('')
const startDate = ref('')
const endDate = ref('')
const startTime = ref('')
const endTime = ref('')
const loading = ref(false)

// 请假种类 → 时间规则
const TYPE_RULES: Record<string, { label: string; start: string; end: string; fixed: boolean }> = {
  '早操':   { label: '早操',   start: '06:00', end: '07:00', fixed: true },
  '早集合': { label: '早集合', start: '07:00', end: '08:10', fixed: true },
  '午集合': { label: '午集合', start: '13:00', end: '14:00', fixed: true },
  '收假集合': { label: '收假集合', start: '18:00', end: '19:00', fixed: true },
  '晚自习': { label: '晚自习', start: '18:30', end: '20:30', fixed: true },
  '中队会': { label: '中队会', start: '',     end: '',     fixed: false },
  '全休':   { label: '全休',   start: '',     end: '',     fixed: false },
  '其他':   { label: '其他',   start: '',     end: '',     fixed: false },
}

const LEAVE_TYPES = [
  { key: '早操', icon: '🏃' },
  { key: '早集合', icon: '🧍' },
  { key: '午集合', icon: '☀️' },
  { key: '收假集合', icon: '🏠' },
  { key: '晚自习', icon: '🌙' },
  { key: '中队会', icon: '📋' },
  { key: '全休', icon: '🛏️' },
  { key: '其他', icon: '📌' },
]

// 每种请假种类的可选原因
const TYPE_REASONS: Record<string, { key: string; icon: string }[]> = {
  '早操':   [{ key: '调休', icon: '🔄' }, { key: '出督', icon: '🎖️' }, { key: '病假', icon: '🤒' }, { key: '事假', icon: '📋' }, { key: '公假', icon: '🏛️' }, { key: '其他', icon: '📌' }],
  '早集合': [{ key: '出督', icon: '🎖️' }, { key: '公区', icon: '🧹' }, { key: '病假', icon: '🤒' }, { key: '事假', icon: '📋' }, { key: '公假', icon: '🏛️' }, { key: '其他', icon: '📌' }],
  '午集合': [{ key: '出督', icon: '🎖️' }, { key: '公区', icon: '🧹' }, { key: '病假', icon: '🤒' }, { key: '事假', icon: '📋' }, { key: '公假', icon: '🏛️' }, { key: '其他', icon: '📌' }],
  '收假集合': [{ key: '公区', icon: '🧹' }, { key: '病假', icon: '🤒' }, { key: '事假', icon: '📋' }, { key: '公假', icon: '🏛️' }, { key: '其他', icon: '📌' }],
  '晚自习': [{ key: '病假', icon: '🤒' }, { key: '事假', icon: '📋' }, { key: '公假', icon: '🏛️' }, { key: '其他', icon: '📌' }],
  '中队会': [{ key: '病假', icon: '🤒' }, { key: '事假', icon: '📋' }, { key: '公假', icon: '🏛️' }, { key: '其他', icon: '📌' }],
  '全休':   [{ key: '病假', icon: '🤒' }, { key: '事假', icon: '📋' }, { key: '公假', icon: '🏛️' }, { key: '其他', icon: '📌' }],
  '其他':   [{ key: '其他', icon: '📌' }],
}

const availableReasons = computed(() => TYPE_REASONS[leaveType.value] || [])
const isFixed = computed(() => TYPE_RULES[leaveType.value]?.fixed ?? false)
const rule = computed(() => TYPE_RULES[leaveType.value] || null)

// 证明材料
const proofs = ref<string[]>([])
const uploadingProof = ref(false)
const proofInput = ref<HTMLInputElement | null>(null)

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildStartEnd(): { start: string; end: string } | null {
  if (!rule.value) return null
  if (rule.value.fixed && startDate.value) {
    const endD = endDate.value || startDate.value
    return {
      start: `${startDate.value}T${rule.value.start}:00`,
      end: `${endD}T${rule.value.end}:00`,
    }
  }
  if (!rule.value.fixed && startDate.value && startTime.value && endDate.value && endTime.value) {
    return {
      start: `${startDate.value}T${startTime.value}:00`,
      end: `${endDate.value}T${endTime.value}:00`,
    }
  }
  return null
}

async function handleSubmit() {
  if (!leaveType.value) { showToast('请选择请假种类', 'error'); return }
  if (!leaveReason.value) { showToast('请选择请假原因', 'error'); return }

  if (isFixed.value) {
    if (!startDate.value) { showToast('请选择日期', 'error'); return }
  } else {
    if (!startDate.value || !startTime.value) { showToast('请填写开始时间', 'error'); return }
    if (!endDate.value || !endTime.value) { showToast('请填写结束时间', 'error'); return }
  }

  const se = buildStartEnd()
  if (!se) { showToast('时间信息不完整', 'error'); return }
  if (se.start >= se.end) { showToast('结束时间必须晚于开始时间', 'error'); return }

  const fullReason = reasonDetail.value.trim()
    ? `${leaveReason.value}：${reasonDetail.value.trim()}`
    : leaveReason.value

  loading.value = true
  try {
    const res = await applyLeave({
      type: leaveType.value,
      reason: fullReason,
      start_time: se.start,
      end_time: se.end,
      attachments: proofs.value.length > 0 ? proofs.value : undefined,
    } as any)
    if (res.success) {
      showToast('提交成功')
      router.replace('/pages/leave/index')
    } else {
      showToast(res.message || '提交失败', 'error')
    }
  } catch (_) { showToast('提交失败', '请稍后重试', 'error') }
  finally { loading.value = false }
}

// 选择种类时重置原因
function selectType(key: string) {
  leaveType.value = key
  leaveReason.value = ''
}

// ── 证明材料上传 ──
function triggerProofUpload() { proofInput.value?.click() }
async function handleProofChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { showToast('仅支持图片', 'error'); target.value = ''; return }
  if (file.size > 10 * 1024 * 1024) { showToast('图片≤10MB', 'error'); target.value = ''; return }
  uploadingProof.value = true
  try {
    const res = await uploadFile('/api/leave/upload-proof', file)
    if (res.success && res.url) proofs.value.push(res.url)
  } catch (e: any) { showToast(e.message || '上传失败', 'error') }
  finally { uploadingProof.value = false; target.value = '' }
}
function removeProof(idx: number) { proofs.value.splice(idx, 1) }
</script>

<template>
  <div class="apply-page">
    <NavBar title="申请请假" show-back />
    <div class="form">
      <!-- 请假种类 -->
      <div class="form-group">
        <label>请假种类</label>
        <div class="grid-5">
          <span v-for="t in LEAVE_TYPES" :key="t.key"
            :class="['option', { active: leaveType === t.key }]"
            @click="selectType(t.key)">
            <span class="opt-icon">{{ t.icon }}</span>
            {{ t.key }}
          </span>
        </div>
        <div v-if="rule?.fixed" class="hint">
          ⏰ 固定时段 <strong>{{ rule.start }}</strong> ~ <strong>{{ rule.end }}</strong>，可跨天
        </div>
        <div v-else-if="rule" class="hint free">
          🕐 自由选择起止时间，可跨天
        </div>
      </div>

      <!-- 请假原因（根据种类动态） -->
      <div v-if="leaveType" class="form-group">
        <label>请假原因</label>
        <div class="reason-grid">
          <span v-for="r in availableReasons" :key="r.key"
            :class="['option', { active: leaveReason === r.key }]"
            @click="leaveReason = r.key">
            <span class="opt-icon">{{ r.icon }}</span>
            {{ r.key }}
          </span>
        </div>
      </div>

      <!-- 时间 -->
      <template v-if="leaveType">
        <div v-if="isFixed" class="form-group">
          <label>请假日期</label>
          <div class="row">
            <input v-model="startDate" type="date" class="input flex-1" :min="todayStr()" />
            <span class="sep">至</span>
            <input v-model="endDate" type="date" class="input flex-1" :min="startDate || todayStr()" />
          </div>
          <div class="field-hint">结束日期留空 = 仅当天；填其他日期 = 该时间段内每天</div>
        </div>

        <template v-else>
          <div class="form-group">
            <label>开始时间</label>
            <div class="row">
              <input v-model="startDate" type="date" class="input flex-1" :min="todayStr()" />
              <input v-model="startTime" type="time" class="input flex-1" />
            </div>
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <div class="row">
              <input v-model="endDate" type="date" class="input flex-1" :min="startDate || todayStr()" />
              <input v-model="endTime" type="time" class="input flex-1" />
            </div>
          </div>
        </template>
      </template>

      <!-- 详细说明 -->
      <div v-if="leaveType" class="form-group">
        <label>详细说明（选填）</label>
        <textarea v-model="reasonDetail" placeholder="可补充说明具体情况" rows="2" class="textarea" maxlength="300" />
        <div class="char-count">{{ reasonDetail.length }}/300</div>
      </div>

      <!-- 证明材料 -->
      <div class="form-group">
        <label>证明材料（选填）</label>
        <div v-if="proofs.length > 0" class="proof-list">
          <div v-for="(url, i) in proofs" :key="i" class="proof-item">
            <img :src="url" class="proof-thumb" />
            <button class="proof-del" @click="removeProof(i)">✕</button>
          </div>
        </div>
        <button class="proof-add-btn" :disabled="uploadingProof" @click="triggerProofUpload">
          {{ uploadingProof ? '上传中…' : '+ 添加证明材料' }}
        </button>
        <input ref="proofInput" type="file" accept="image/*" class="file-hidden" @change="handleProofChange" />
        <div class="proof-hint">可上传病历、请假条等证明图片</div>
      </div>

      <button class="submit-btn" :disabled="loading" @click="handleSubmit">
        {{ loading ? '提交中...' : '提交申请' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.apply-page { padding-bottom: 80px; }
.form { padding: 20px 16px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }

.grid-5 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.reason-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
@media (min-width: 400px) { .grid-5 { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 400px) { .reason-grid { grid-template-columns: repeat(4, 1fr); } }

.option {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 10px 6px; border-radius: var(--radius-md);
  font-size: 12px; font-weight: 500; cursor: pointer; text-align: center;
  background: var(--color-surface); color: var(--color-text-2);
  border: 1px solid var(--color-border); transition: all 0.15s;
}
.option .opt-icon { font-size: 18px; }
.option.active { background: var(--color-accent-bg); color: var(--color-accent); border-color: var(--color-accent); font-weight: 700; }

.hint {
  margin-top: 10px; padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--color-accent-bg); color: var(--color-accent);
  font-size: 13px; text-align: center; font-weight: 500;
}
.hint.free { background: #dcfce7; color: #16a34a; }

.row { display: flex; gap: 6px; align-items: center; }
.flex-1 { flex: 1; }
.sep { font-size: 13px; color: var(--color-text-3); flex-shrink: 0; }
.field-hint { font-size: 11px; color: var(--color-text-3); margin-top: 6px; }

.input, .textarea {
  width: 100%; padding: 12px 14px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: 15px; outline: none;
  background: var(--color-surface); color: var(--color-text);
  box-sizing: border-box;
}
.input:focus, .textarea:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
.textarea { resize: vertical; min-height: 60px; line-height: 1.6; }
.char-count { text-align: right; font-size: 12px; color: var(--color-text-3); margin-top: 4px; }
.submit-btn {
  width: 100%; height: 48px; border: none; border-radius: var(--radius-md);
  background: var(--color-accent); color: #fff; font-size: 16px; font-weight: 600;
  cursor: pointer; transition: opacity 0.2s; margin-top: 8px;
}
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 证明材料 */
.proof-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.proof-item { position: relative; width: 72px; height: 72px; border-radius: var(--radius-sm); overflow: hidden; }
.proof-thumb { width: 100%; height: 100%; object-fit: cover; }
.proof-del {
  position: absolute; top: 2px; right: 2px; width: 20px; height: 20px;
  border: none; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff;
  font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.proof-add-btn {
  width: 100%; padding: 10px; border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm); background: transparent;
  color: var(--color-accent); font-size: 13px; font-weight: 500; cursor: pointer;
}
.proof-add-btn:disabled { opacity: 0.5; }
.proof-hint { font-size: 11px; color: var(--color-text-3); margin-top: 6px; }
.file-hidden { display: none; }
</style>
