<script setup lang="ts">
/**
 * 花名册导入（预览 → 确认导入）
 *
 * 2026-09 修复：
 *  - 错误态：预览失败此前只弹 toast，错误区留空；现在 error 交给 StateView 渲染 + 重试
 *  - 竞态：多次「选择文件 / 重新预览」用自增 reqId，只接受最新一次响应，
 *    避免先发的慢请求覆盖后发结果（表格里放的是 A 文件、实际应用 B 文件）
 *  - 破坏性操作：确认导入 / 清空预览都走 showConfirm，文案含「对象 + 动作 + 后果」
 *  - emoji → AppIcon；按钮 → BaseButton；空态 → EmptyState
 */
import { computed, ref } from 'vue'
import { applyRoster, uploadRosterPreview } from '@/api/admin'
import type { RosterPreview } from '@/api/admin'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

type RosterPlan = RosterPreview['plan'][number]

interface ApplyResult {
  summary: RosterPreview['summary']
  created: { student_id: string; name: string }[]
  defaultPassword: string
  message?: string
}

/** 差异字段的中文名，未知字段直接展示原字段名 */
const FIELD_LABELS: Record<string, string> = {
  name: '姓名',
  student_id: '学号',
  class_id: '区队',
  company_id: '中队',
  member_type: '成员类型',
  role: '职务',
  duty_note: '备注',
  status: '状态',
}

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const preview = ref<RosterPreview | null>(null)
const previewing = ref(false)
const previewError = ref<unknown>(null)
const applying = ref(false)
const result = ref<ApplyResult | null>(null)

/** 竞态守卫：只接受最新一次预览响应 */
let previewSeq = 0

const plan = computed<RosterPlan[]>(() => preview.value?.plan || [])
const summary = computed(() => preview.value?.summary || { create: 0, update: 0, leave: 0, unchanged: 0 })
const globalWarnings = computed(() => preview.value?.warnings || [])
const needConfirm = computed(() => summary.value.leave > 0 || globalWarnings.value.length > 0)
const previewEmpty = computed(() => !!preview.value && plan.value.length === 0)

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field
}

function showValue(val: string | null | undefined): string {
  const s = (val ?? '').toString().trim()
  return s === '' ? '（空）' : s
}

/** 表内人数 = 新增 + 更新 + 无变化（移出的人不在表内） */
function inSheetCount(p: RosterPlan): number {
  return (p.creates?.length || 0) + (p.updates?.length || 0) + (p.unchangedCount || 0)
}

function classWarningCount(p: RosterPlan): number {
  return p.warnings?.length || 0
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  if (!/\.xlsx$/i.test(file.name)) {
    showToast('请选择 .xlsx 格式的花名册文件', 'error')
    input.value = ''
    return
  }
  selectedFile.value = file
  preview.value = null
  previewError.value = null
  result.value = null
  await runPreview()
}

async function runPreview() {
  const file = selectedFile.value
  if (!file) return
  const seq = ++previewSeq
  previewing.value = true
  previewError.value = null
  try {
    const res = await uploadRosterPreview(file)
    if (seq !== previewSeq) return
    preview.value = res.data
    if (!res.data || (res.data.plan || []).length === 0) {
      showToast('未解析到任何区队数据，请检查表格格式', 'error')
    }
  } catch (e) {
    if (seq !== previewSeq) return
    preview.value = null
    previewError.value = e
    toastIfNotNotified(e, '预览失败，请检查文件内容')
  } finally {
    if (seq === previewSeq) previewing.value = false
  }
}

async function handleRePreview() {
  if (!selectedFile.value || previewing.value || applying.value) return
  preview.value = null
  previewError.value = null
  result.value = null
  await runPreview()
}

async function resetAll() {
  if (previewing.value || applying.value) return
  const ok = await showConfirm('清空导入预览', '确定清空已选择的花名册与本次预览结果？', {
    confirmText: '清空预览',
    hint: '只清空当前页面上的预览，不会改动服务器上的任何数据；如需继续请重新选择文件。',
  })
  if (!ok) return
  // 作废在途预览响应
  previewSeq++
  selectedFile.value = null
  preview.value = null
  previewError.value = null
  result.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function handleApply() {
  const file = selectedFile.value
  if (!file || !preview.value || applying.value) return
  const s = summary.value
  const ok = await showConfirm(
    '确认导入花名册',
    `按当前预览导入《${file.name}》？将新增 ${s.create} 人、更新 ${s.update} 人、移出 ${s.leave} 人。`,
    {
      confirmText: '确认导入',
      danger: s.leave > 0,
      hint:
        s.leave > 0
          ? `移出的 ${s.leave} 人不计入在队人数（历史记录保留），职务与备注不会被改动；导入以表格为准，无法一键撤销。`
          : '导入以表格为准，会新增/更新账号信息（不改动职务与备注），请再次核对预览内容。',
    }
  )
  if (!ok) return
  applying.value = true
  try {
    const res = await applyRoster(file)
    result.value = res.data
    showToast(res.message || '花名册导入完成', 'success')
  } catch (e: any) {
    toastIfNotNotified(e, '导入失败，请稍后重试')
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <section>
    <h2>花名册导入</h2>

    <!-- 规则说明 -->
    <div class="info-card">
      <div class="info-title">导入规则（以表格为准）</div>
      <ul class="info-list">
        <li>表格里有的学员：不存在则<strong>新建</strong>，已存在则按表格内容<strong>更新</strong>。</li>
        <li>表格里没有的学员：<strong>移出统计</strong>（不计入在队人数），但历史记录保留。</li>
        <li>导入<strong>不会改动职务与备注</strong>，也不会删除任何历史数据。</li>
      </ul>
      <div class="info-hint">文件格式要求：.xlsx 花名册，每张工作表对应一个区队。</div>
    </div>

    <!-- 选择文件 -->
    <div class="upload-card">
      <label class="upload-label">选择花名册文件</label>
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx"
        class="file-input"
        :disabled="previewing || applying"
        @change="onFileChange"
      />
      <div v-if="selectedFile" class="file-name">已选择：{{ selectedFile.name }}</div>
      <div class="upload-hint">选择后立即生成预览，确认无误再点「确认导入」。</div>
      <div class="upload-actions">
        <BaseButton
          variant="secondary"
          size="sm"
          :loading="previewing"
          :disabled="!selectedFile || applying"
          @click="handleRePreview"
        >
          重新预览
        </BaseButton>
        <BaseButton variant="ghost" size="sm" :disabled="!selectedFile || previewing || applying" @click="resetAll">
          清空
        </BaseButton>
      </div>
    </div>

    <!-- 预览（加载 / 失败重试 / 内容） -->
    <StateView
      :loading="previewing"
      :error="previewError"
      loading-text="正在解析花名册…"
      @retry="handleRePreview"
    >
      <EmptyState
        v-if="previewEmpty"
        icon="file"
        variant="filtered"
        title="没有解析到任何区队数据"
        description="常见原因：工作表缺少学号/姓名列、表头不在第一行，或文件不是 .xlsx。请核对后重新预览。"
        action-text="重新预览"
        @action="handleRePreview"
      />

      <template v-else-if="preview">
        <!-- 汇总条 -->
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-value">{{ summary.create }}</span>
            <span class="summary-label">新增</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ summary.update }}</span>
            <span class="summary-label">更新</span>
          </div>
          <div class="summary-item">
            <span class="summary-value summary-leave">{{ summary.leave }}</span>
            <span class="summary-label">移出</span>
          </div>
          <div class="summary-item">
            <span class="summary-value summary-muted">{{ summary.unchanged }}</span>
            <span class="summary-label">无变化</span>
          </div>
        </div>

        <!-- 需要确认的醒目提示 -->
        <div v-if="needConfirm" class="alert-bar">
          <div class="alert-line alert-title">
            <AppIcon name="alert-triangle" :size="15" />
            <span>请确认后再导入：</span>
          </div>
          <div v-if="summary.leave > 0" class="alert-line">
            本次将把 {{ summary.leave }} 名学员移出统计（历史记录保留，不计入在队人数）。
          </div>
          <div v-if="globalWarnings.length > 0" class="alert-line">
            共有 {{ globalWarnings.length }} 条提醒需要核对。
          </div>
        </div>

        <!-- 全局提醒 -->
        <div v-if="globalWarnings.length > 0" class="warn-list">
          <div v-for="(w, i) in globalWarnings" :key="'gw-' + i" class="warn-bar">
            <AppIcon name="alert-triangle" :size="13" />
            <span><span v-if="w.class">[{{ w.class }}] </span>{{ w.text }}</span>
          </div>
        </div>

        <!-- 每个区队一张卡片 -->
        <div class="plan-cards">
          <div v-for="p in plan" :key="p.class_id + '-' + p.sheet" class="plan-card">
            <div class="plan-header">
              <span class="plan-name">{{ p.class_name || p.class_id }}</span>
              <span class="plan-sheet">工作表：{{ p.sheet }}（共 {{ p.sheetCount }} 张）</span>
            </div>
            <div class="plan-meta">
              表内 {{ inSheetCount(p) }} 人 · 新增 {{ p.creates?.length || 0 }} / 更新 {{ p.updates?.length || 0 }} /
              移出 {{ p.leaves?.length || 0 }} / 无变化 {{ p.unchangedCount || 0 }}
            </div>

            <!-- 区队级 warnings -->
            <div v-if="classWarningCount(p) > 0" class="warn-list">
              <div v-for="(w, i) in p.warnings" :key="'pw-' + i" class="warn-bar">
                <AppIcon name="alert-triangle" :size="13" />
                <span>{{ w.text }}</span>
              </div>
            </div>

            <div v-if="(p.creates?.length || 0) > 0" class="plan-block">
              <div class="block-label">新增（{{ p.creates.length }}）</div>
              <ul class="plain-list">
                <li v-for="c in p.creates" :key="'c-' + c.student_id">
                  <span class="sid">{{ c.student_id }}</span>
                  <span class="nm">{{ c.name }}</span>
                </li>
              </ul>
            </div>

            <div v-if="(p.updates?.length || 0) > 0" class="plan-block">
              <div class="block-label">更新（{{ p.updates.length }}）</div>
              <ul class="plain-list">
                <li v-for="u in p.updates" :key="'u-' + u.id" class="update-item">
                  <div>
                    <span class="sid">{{ u.student_id }}</span>
                    <span class="nm">{{ u.name }}</span>
                  </div>
                  <div v-if="(u.diffs?.length || 0) > 0" class="diff-list">
                    <span v-for="(d, i) in u.diffs" :key="'d-' + i" class="diff-item">
                      {{ fieldLabel(d.field) }}：{{ showValue(d.from) }} → {{ showValue(d.to) }}
                    </span>
                  </div>
                  <div v-else class="diff-item">字段无变化</div>
                </li>
              </ul>
            </div>

            <div v-if="(p.leaves?.length || 0) > 0" class="plan-block">
              <div class="block-label block-label-warn">移出（{{ p.leaves.length }}）</div>
              <ul class="plain-list">
                <li v-for="l in p.leaves" :key="'l-' + l.id">
                  <span class="sid">{{ l.student_id }}</span>
                  <span class="nm">{{ l.name }}</span>
                  <span class="tag-leave">{{ l.member_type === 'student' ? '学员' : l.member_type || '成员' }}</span>
                </li>
              </ul>
            </div>

            <div
              v-if="
                (p.creates?.length || 0) === 0 &&
                (p.updates?.length || 0) === 0 &&
                (p.leaves?.length || 0) === 0
              "
              class="empty-msg"
            >
              该区队无人员变动（无变化 {{ p.unchangedCount || 0 }} 人）
            </div>
          </div>
        </div>

        <!-- 确认导入 -->
        <div class="apply-bar">
          <BaseButton :loading="applying" :disabled="previewing" @click="handleApply">确认导入</BaseButton>
          <span class="apply-hint">
            将新增 {{ summary.create }} 人、更新 {{ summary.update }} 人、移出 {{ summary.leave }} 人
          </span>
        </div>
      </template>
    </StateView>

    <!-- 尚未选择文件的空态 -->
    <EmptyState
      v-if="!previewing && !preview && !selectedFile"
      icon="upload"
      title="还没有选择花名册文件"
      description="先在上方选择 .xlsx 花名册；系统会先给出逐区队的差异预览，确认无误后再执行导入。"
    />

    <!-- 导入结果 -->
    <div v-if="result" class="result-card">
      <div class="result-title">
        <AppIcon name="check-circle" :size="16" />
        <span>{{ result.message || '导入完成' }}</span>
      </div>
      <div class="result-line">
        本次处理：新增 {{ result.summary?.create || 0 }} 人、更新 {{ result.summary?.update || 0 }} 人、移出
        {{ result.summary?.leave || 0 }} 人、无变化 {{ result.summary?.unchanged || 0 }} 人
      </div>
      <div v-if="(result.created?.length || 0) > 0" class="result-block">
        <div class="block-label">本次新建账号（{{ result.created.length }}）</div>
        <ul class="plain-list">
          <li v-for="c in result.created" :key="'rc-' + c.student_id">
            <span class="sid">{{ c.student_id }}</span>
            <span class="nm">{{ c.name }}</span>
          </li>
        </ul>
      </div>
      <div class="result-line result-pwd">
        本次新建账号的初始密码：<strong>{{ result.defaultPassword || '123456' }}</strong>
      </div>
      <div class="result-line">用户初始密码：123456（请提醒学员首次登录后及时修改）。</div>
    </div>
  </section>
</template>

<style scoped>
h2 {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px;
}

/* ========== 说明卡 ========== */
.info-card {
  background: var(--color-accent-bg);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 16px;
}
.info-title { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.info-list { margin: 0; padding-left: 18px; }
.info-list li { font-size: var(--font-size-sm); color: var(--color-text-2); line-height: 1.7; }
.info-list strong { color: var(--color-accent); }
.info-hint { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 6px; }

/* ========== 上传区 ========== */
.upload-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 16px;
}
.upload-label { display: block; font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-2); margin-bottom: 6px; }
.file-input { font-size: var(--font-size-sm); color: var(--color-text-2); max-width: 100%; }
.file-name { font-size: var(--font-size-sm); color: var(--color-text); margin-top: 6px; word-break: break-all; }
.upload-hint { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 6px; }
.upload-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

/* ========== 汇总条 ========== */
.summary-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.summary-item {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
  text-align: center;
}
.summary-value { display: block; font-size: 22px; font-weight: 700; color: var(--color-accent); }
.summary-leave { color: var(--color-warning); }
.summary-muted { color: var(--color-text-3); }
.summary-label { font-size: var(--font-size-xs); color: var(--color-text-2); }

/* ========== 提醒 ========== */
.alert-bar {
  background: var(--color-warning);
  color: #fff;
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-bottom: 12px;
}
.alert-line { font-size: var(--font-size-sm); line-height: 1.7; }
.alert-title { display: flex; align-items: center; gap: 5px; font-weight: 600; }
.warn-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.warn-bar {
  display: flex; align-items: flex-start; gap: 6px;
  background: var(--color-accent-bg);
  border-left: 3px solid var(--color-warning);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

/* ========== 区队预览卡 ========== */
.plan-cards { display: flex; flex-direction: column; gap: 12px; }
.plan-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px;
  box-shadow: var(--shadow-card);
  min-width: 0;
}
.plan-header {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; flex-wrap: wrap;
  padding-bottom: 8px; margin-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}
.plan-name { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); }
.plan-sheet { font-size: var(--font-size-xs); color: var(--color-text-3); }
.plan-meta { font-size: var(--font-size-sm); color: var(--color-text-2); margin-bottom: 8px; line-height: 1.6; }
.plan-block { margin-bottom: 8px; }
.block-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-2); margin-bottom: 4px; }
.block-label-warn { color: var(--color-warning); }
.plain-list { margin: 0; padding-left: 0; list-style: none; }
.plain-list li {
  font-size: var(--font-size-sm); color: var(--color-text);
  padding: 4px 0; border-bottom: 1px dashed var(--color-border);
}
.plain-list li:last-child { border-bottom: none; }
.sid { color: var(--color-text-2); margin-right: 8px; font-variant-numeric: tabular-nums; }
.nm { color: var(--color-text); }
.update-item { display: flex; flex-direction: column; gap: 2px; }
.diff-list { display: flex; flex-wrap: wrap; gap: 6px; }
.diff-item { font-size: var(--font-size-xs); color: var(--color-text-3); }
.tag-leave {
  margin-left: 8px; font-size: var(--font-size-2xs);
  background: var(--color-warning-bg); color: var(--color-warning);
  padding: 1px 6px; border-radius: var(--radius-full);
}

/* ========== 结果 ========== */
.apply-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.apply-hint { font-size: var(--font-size-xs); color: var(--color-text-3); }

.result-card {
  margin-top: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.result-title {
  display: flex; align-items: center; gap: 6px;
  font-size: var(--font-size-body); font-weight: 600; color: var(--color-success); margin-bottom: 8px;
}
.result-line { font-size: var(--font-size-sm); color: var(--color-text-2); line-height: 1.8; }
.result-pwd strong { color: var(--color-accent); }
.result-block { margin: 8px 0; }

.empty-msg { text-align: center; padding: 20px; color: var(--color-text-3); font-size: var(--font-size-sm); }

/* ========== 响应式 ========== */
@media (max-width: 768px) {
  h2 { font-size: var(--font-size-lg); margin-bottom: 12px; }
  .summary-bar { grid-template-columns: repeat(2, 1fr); }
  .summary-value { font-size: 19px; }
  .upload-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .upload-actions :deep(.btn) { width: 100%; }
  .apply-bar :deep(.btn) { width: 100%; }
}
</style>
