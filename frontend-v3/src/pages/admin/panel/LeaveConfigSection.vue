<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LeaveTypeConfig } from '@/api/leave-config'

interface EditableConfig extends LeaveTypeConfig {
  _startH?: string
  _startM?: string
  _endH?: string
  _endM?: string
}

const props = defineProps<{
  configs: LeaveTypeConfig[]
  loading: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'save', config: EditableConfig): void
}>()

const editableConfigs = ref<EditableConfig[]>([])
const newReasonInput = ref<Record<number, string>>({})

function parseTime(t: string | null): { h: string; m: string } {
  if (!t) return { h: '', m: '' }
  const parts = t.split(':')
  return { h: parts[0] || '', m: parts[1] || '' }
}

function packTime(h: string, m: string): string | null {
  if (!h && !m) return null
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
}

watch(
  () => props.configs,
  (list) => {
    editableConfigs.value = (list || []).map((c) => {
      const start = parseTime(c.start_time)
      const end = parseTime(c.end_time)
      return { ...c, _startH: start.h, _startM: start.m, _endH: end.h, _endM: end.m }
    })
  },
  { immediate: true }
)

function onTimeChange(cfg: EditableConfig) {
  cfg.start_time = packTime(cfg._startH || '', cfg._startM || '')
  cfg.end_time = packTime(cfg._endH || '', cfg._endM || '')
}

function handleSave(cfg: EditableConfig) {
  onTimeChange(cfg)
  emit('save', cfg)
}

function addReason(cfg: EditableConfig) {
  const val = (newReasonInput.value[cfg.id] || '').trim()
  if (!val) return
  if (!Array.isArray(cfg.reasons)) cfg.reasons = []
  if (!cfg.reasons.includes(val)) {
    cfg.reasons.push(val)
  }
  newReasonInput.value[cfg.id] = ''
}

function removeReason(cfg: EditableConfig, idx: number) {
  if (Array.isArray(cfg.reasons)) cfg.reasons.splice(idx, 1)
}
</script>

<template>
  <section>
    <h2>请假类型配置</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="config-cards">
      <div v-for="cfg in editableConfigs" :key="cfg.id" class="config-card">
        <div class="cfg-header">
          <strong class="cfg-name">{{ cfg.type_name }}</strong>
          <label class="cfg-toggle">
            <input type="checkbox" v-model="cfg.enabled" :true-value="1" :false-value="0" />
            <span>{{ cfg.enabled ? '已启用' : '已禁用' }}</span>
          </label>
        </div>

        <div class="cfg-row">
          <label class="cfg-label">固定时段</label>
          <label class="cfg-check">
            <input type="checkbox" v-model="cfg.is_fixed" :true-value="1" :false-value="0" />
            固定时段
          </label>
        </div>

        <div v-if="cfg.is_fixed" class="cfg-row">
          <label class="cfg-label">时间窗口</label>
          <div class="time-inputs">
            <select v-model="cfg._startH" @change="onTimeChange(cfg)">
              <option value="">时</option>
              <option v-for="h in 24" :key="h" :value="String(h - 1).padStart(2,'0')">{{ String(h - 1).padStart(2,'0') }}</option>
            </select>
            <span>:</span>
            <select v-model="cfg._startM" @change="onTimeChange(cfg)">
              <option value="">分</option>
              <option value="00">00</option><option value="30">30</option>
            </select>
            <span class="time-sep">–</span>
            <select v-model="cfg._endH" @change="onTimeChange(cfg)">
              <option value="">时</option>
              <option v-for="h in 24" :key="h" :value="String(h - 1).padStart(2,'0')">{{ String(h - 1).padStart(2,'0') }}</option>
            </select>
            <span>:</span>
            <select v-model="cfg._endM" @change="onTimeChange(cfg)">
              <option value="">分</option>
              <option value="00">00</option><option value="30">30</option>
            </select>
          </div>
        </div>

        <div class="cfg-row">
          <label class="cfg-label">理由选项</label>
          <div class="reason-tags">
            <span v-for="(r, i) in (Array.isArray(cfg.reasons) ? cfg.reasons : [])" :key="i" class="reason-tag">
              {{ r }}
              <button class="tag-del" @click="removeReason(cfg, i)">✕</button>
            </span>
            <span class="reason-add">
              <input
                v-model="newReasonInput[cfg.id]"
                placeholder="新理由"
                class="reason-input"
                @keyup.enter="addReason(cfg)"
              />
              <button class="btn-xs" @click="addReason(cfg)">+</button>
            </span>
          </div>
        </div>

        <button class="btn-sm cfg-save" :disabled="saving" @click="handleSave(cfg)">保存</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px;
}

/* ========== Config Cards ========== */
.config-cards { display: flex; flex-direction: column; gap: 12px; }
.config-card {
  background: var(--color-surface);
  border-radius: 10px;
  padding: 14px;
  box-shadow: var(--shadow-card);
}
.cfg-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}
.cfg-name { font-size: 15px; color: var(--color-text); }
.cfg-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-2); cursor: pointer; }
.cfg-row { margin-bottom: 10px; }
.cfg-label { display: block; font-size: 12px; font-weight: 600; color: var(--color-text-2); margin-bottom: 4px; }
.cfg-check { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--color-text); cursor: pointer; }
.time-inputs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.time-inputs select {
  padding: 6px 8px; border: 1px solid var(--color-border);
  border-radius: 4px; font-size: 13px; background: var(--color-surface-2); color: var(--color-text);
}
.time-sep { margin: 0 2px; color: var(--color-text-3); }

/* reasons */
.reason-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.reason-tag {
  display: inline-flex; align-items: center; gap: 2px;
  background: var(--color-accent-bg); color: var(--color-accent);
  padding: 3px 8px; border-radius: 12px; font-size: 12px;
}
.tag-del {
  background: none; border: none; color: var(--color-accent);
  font-size: 10px; cursor: pointer; padding: 0; line-height: 1;
  opacity: 0.6;
}
.tag-del:hover { opacity: 1; }
.reason-add { display: inline-flex; gap: 4px; align-items: center; }
.reason-input {
  width: 70px; height: 28px; border: 1px dashed var(--color-border);
  border-radius: 12px; padding: 0 8px; font-size: 12px;
  background: transparent; color: var(--color-text);
}
.btn-xs {
  width: 24px; height: 24px; border: none; border-radius: 50%;
  background: var(--color-accent); color: #fff; font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.cfg-save { margin-top: 6px; }

.btn-sm {
  padding: 8px 16px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.loading { padding: 40px; text-align: center; color: var(--color-text-2); font-size: 14px; }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: 18px; margin-bottom: 12px; }
}
</style>
