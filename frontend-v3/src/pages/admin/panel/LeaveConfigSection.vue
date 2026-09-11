<script setup lang="ts">
/**
 * 请假类型配置（受控组件：数据与保存都由 panel.vue 负责）
 *
 * 2026-09 修复：
 *  - 新增 error / retry：加载失败由 StateView 渲染错误态 + 重试按钮，
 *    不再只弹一句 toast 后留下一片空白
 *  - 按钮 → BaseButton；删除理由的 ✕ 文字 → AppIcon
 *  - 无配置数据时给 EmptyState（说明为什么空 + 下一步）
 */
import { ref, watch } from 'vue'
import type { LeaveTypeConfig } from '@/api/leave-config'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

interface EditableConfig extends LeaveTypeConfig {
  _startH?: string
  _startM?: string
  _endH?: string
  _endM?: string
}

const props = withDefaults(
  defineProps<{
    configs: LeaveTypeConfig[]
    loading: boolean
    saving: boolean
    /** 加载失败的错误对象（来自 panel.vue） */
    error?: unknown
  }>(),
  { error: null }
)

const emit = defineEmits<{
  (e: 'save', config: EditableConfig): void
  (e: 'retry'): void
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

    <StateView
      :loading="loading"
      :error="error"
      :empty="editableConfigs.length === 0"
      loading-text="正在加载请假类型配置…"
      @retry="emit('retry')"
    >
      <template #empty>
        <EmptyState
          icon="calendar"
          title="没有可配置的请假类型"
          description="系统还没有初始化请假类型；请联系后端在 leave_type_config 表写入初始数据后再刷新。"
          action-text="重新加载"
          @action="emit('retry')"
        />
      </template>

      <div class="config-cards">
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
                <button class="tag-del" type="button" :aria-label="`删除理由 ${r}`" @click="removeReason(cfg, i)">
                  <AppIcon name="close" :size="11" />
                </button>
              </span>
              <span class="reason-add">
                <input
                  v-model="newReasonInput[cfg.id]"
                  placeholder="新理由"
                  class="reason-input"
                  @keyup.enter="addReason(cfg)"
                />
                <BaseButton variant="primary" size="sm" class="reason-add-btn" @click="addReason(cfg)">
                  <AppIcon name="plus" :size="13" />
                </BaseButton>
              </span>
            </div>
          </div>

          <BaseButton class="cfg-save" :loading="saving" @click="handleSave(cfg)">保存</BaseButton>
        </div>
      </div>
    </StateView>
  </section>
</template>

<style scoped>
h2 {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px;
}

/* ========== Config Cards ========== */
.config-cards { display: flex; flex-direction: column; gap: 12px; }
.config-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px;
  box-shadow: var(--shadow-card);
}
.cfg-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}
.cfg-name { font-size: var(--font-size-md); color: var(--color-text); }
.cfg-toggle { display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); color: var(--color-text-2); cursor: pointer; }
.cfg-toggle input { width: 15px; height: 15px; accent-color: var(--color-accent); }
.cfg-row { margin-bottom: 10px; }
.cfg-label { display: block; font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-2); margin-bottom: 4px; }
.cfg-check { display: flex; align-items: center; gap: 4px; font-size: var(--font-size-sm); color: var(--color-text); cursor: pointer; }
.cfg-check input { width: 15px; height: 15px; accent-color: var(--color-accent); }
.time-inputs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.time-inputs select {
  padding: 6px 8px; border: 1px solid var(--color-border);
  border-radius: 4px; font-size: var(--font-size-sm); background: var(--color-surface-2); color: var(--color-text);
}
.time-sep { margin: 0 2px; color: var(--color-text-3); }

/* reasons */
.reason-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.reason-tag {
  display: inline-flex; align-items: center; gap: 2px;
  background: var(--color-accent-bg); color: var(--color-accent);
  padding: 3px 8px; border-radius: var(--radius-full); font-size: var(--font-size-xs);
}
.tag-del {
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--color-accent);
  cursor: pointer; padding: 0; line-height: 1;
  opacity: 0.6;
}
.tag-del:hover { opacity: 1; }
.reason-add { display: inline-flex; gap: 4px; align-items: center; }
.reason-input {
  width: 90px; height: 32px; border: 1px dashed var(--color-border);
  border-radius: var(--radius-full); padding: 0 10px; font-size: var(--font-size-xs);
  background: transparent; color: var(--color-text);
}
.reason-add-btn { min-height: 32px; padding: 4px 10px; border-radius: var(--radius-full); }
.cfg-save { margin-top: 6px; }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: var(--font-size-lg); margin-bottom: 12px; }
  .cfg-save { width: 100%; }
}
</style>
