<script setup lang="ts">
/**
 * 审计日志
 *
 * 2026-09 修复：
 *  - 错误态：catch 不再把失败写成一行文案，error 交给 StateView（带「重试」按钮）
 *  - 竞态：关键词防抖 + 多选筛选用自增 reqId，只接受最新一次响应
 *    （此前连续改筛选条件时，先发的慢请求会覆盖后发的快请求 → 列表与筛选条件不一致）
 *  - emoji 图标 → AppIcon；按钮 → BaseButton；硬编码色值 → 令牌
 *  - 导出走 downloadFile（带鉴权），失败有提示
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAuditLog, listMembers } from '@/api/admin'
import { downloadFile } from '@/utils/request'
import { showToast } from '@/utils/ui'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { AuditRow } from '@/api/admin'

type AuditQuery = Parameters<typeof getAuditLog>[0]

const PAGE_SIZES = [50, 100]
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE']
const STATUS_OPTIONS = [200, 400, 403, 404, 500]

interface MemberOption {
  id: number
  name: string
  student_id: string
}

/* ================= 筛选状态 ================= */
const keyword = ref('')
const method = ref('')
const status = ref('')
const errorsOnly = ref(false)
const fromDate = ref('')
const toDate = ref('')
const memberId = ref('')

/* ================= 列表状态 ================= */
const loading = ref(false)
/** 错误对象（含 message/code），交给 StateView 渲染错误态 + 重试 */
const error = ref<unknown>(null)
const rows = ref<AuditRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(PAGE_SIZES[0])
const stats24h = ref({ all_count: 0, errors: 0, server_errors: 0 })
const expandedIds = ref<number[]>([])
const exporting = ref(false)

/* ================= 成员下拉（可选功能，失败降级但仍提示） ================= */
const members = ref<MemberOption[]>([])
const membersLoaded = ref(false)
const membersError = ref(false)

/** 竞态守卫：自增请求号，只接受最新一次响应 */
let reqSeq = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasFilter = computed(
  () =>
    !!keyword.value.trim() ||
    !!method.value ||
    !!status.value ||
    !!fromDate.value ||
    !!toDate.value ||
    !!memberId.value ||
    errorsOnly.value
)

/* ================= 查询参数 ================= */
function buildQuery(): AuditQuery {
  const q: AuditQuery = {}
  const kw = keyword.value.trim()
  if (kw) q.keyword = kw
  if (method.value) q.method = method.value
  if (status.value) q.status = Number(status.value)
  if (errorsOnly.value) q.errorsOnly = 1
  if (fromDate.value) q.from = `${fromDate.value} 00:00:00`
  if (toDate.value) q.to = `${toDate.value} 23:59:59`
  if (memberId.value) q.userId = Number(memberId.value)
  return q
}

async function reload(targetPage = 1) {
  const seq = ++reqSeq
  page.value = targetPage
  loading.value = true
  error.value = null
  try {
    const res = await getAuditLog({
      ...buildQuery(),
      page: page.value,
      pageSize: pageSize.value
    })
    // 过期响应直接丢弃（筛选条件已经变了）
    if (seq !== reqSeq) return
    const data = res?.data
    if (res?.success && data) {
      rows.value = data.rows || []
      total.value = Number(data.total) || 0
      stats24h.value = {
        all_count: Number(data.stats24h?.all_count) || 0,
        errors: Number(data.stats24h?.errors) || 0,
        server_errors: Number(data.stats24h?.server_errors) || 0
      }
    } else {
      rows.value = []
      total.value = 0
      error.value = new Error('审计日志加载失败，请稍后重试')
    }
  } catch (err) {
    if (seq !== reqSeq) return
    rows.value = []
    total.value = 0
    error.value = err instanceof Error ? err : new Error('审计日志加载失败，请稍后重试')
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

async function loadMembers() {
  membersError.value = false
  try {
    const res = await listMembers({ page: 1, pageSize: 200 })
    if (res?.success) members.value = res.members || []
  } catch {
    // 成员下拉为可选功能：失败时降级为「不显示该筛选项」，并在筛选区给出可重试的提示
    members.value = []
    membersError.value = true
  } finally {
    membersLoaded.value = true
  }
}

/* ================= 筛选变化 → 回到第 1 页 ================= */
let keywordTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    void reload(1)
  }, 300)
})

watch([method, status, errorsOnly, fromDate, toDate, memberId], () => {
  void reload(1)
})

watch(pageSize, () => {
  void reload(1)
})

onMounted(() => {
  void reload(1)
  void loadMembers()
})

onBeforeUnmount(() => {
  if (keywordTimer) clearTimeout(keywordTimer)
  // 卸载后不再接受在途响应
  reqSeq++
})

/* ================= 交互 ================= */
function resetFilters() {
  keyword.value = ''
  method.value = ''
  status.value = ''
  errorsOnly.value = false
  fromDate.value = ''
  toDate.value = ''
  memberId.value = ''
  if (keywordTimer) clearTimeout(keywordTimer)
  void reload(1)
}

function prevPage() {
  if (page.value > 1 && !loading.value) void reload(page.value - 1)
}

function nextPage() {
  if (page.value < totalPages.value && !loading.value) void reload(page.value + 1)
}

function onPageSizeChange(e: Event) {
  pageSize.value = Number((e.target as HTMLSelectElement).value) || PAGE_SIZES[0]
}

function toggleRow(id: number) {
  const idx = expandedIds.value.indexOf(id)
  if (idx >= 0) expandedIds.value.splice(idx, 1)
  else expandedIds.value.push(id)
}

function isExpanded(id: number): boolean {
  return expandedIds.value.includes(id)
}

function displayName(row: AuditRow): string {
  return row.user_name || (row.user_id != null ? `用户 #${row.user_id}` : '匿名')
}

function statusClass(code: number | null | undefined): string {
  const c = Number(code) || 0
  if (c >= 500) return 'err'
  if (c >= 400) return 'warn'
  return 'ok'
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '—'
  return String(t).slice(0, 19).replace('T', ' ')
}

/* ================= 导出 ================= */
async function exportCsv() {
  if (exporting.value) return
  exporting.value = true
  const params: Record<string, string> = { limit: '5000' }
  const q = buildQuery()
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === '') continue
    params[key] = String(value)
  }
  try {
    // 必须带 Authorization 头下载：window.open 不会带令牌（此前导出 100% 401）
    await downloadFile('/api/admin/audit/export', 'audit-log.csv', params)
    showToast('导出已开始', 'success')
  } catch (e: any) {
    showToast(e?.message || '导出失败，请稍后重试', 'error')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section>
    <h2>审计日志</h2>

    <!-- 近 24 小时统计 -->
    <div class="audit-section">
      <div class="section-label">近 24 小时</div>
      <div v-if="error" class="stats-placeholder">统计口径随请求明细一同加载</div>
      <div v-else class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><AppIcon name="chart" :size="18" /></div>
          <div class="stat-value">{{ stats24h.all_count }}</div>
          <div class="stat-label">请求总数</div>
          <div class="stat-sub">近 24 小时全部接口调用</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warn"><AppIcon name="alert-triangle" :size="18" /></div>
          <div class="stat-value warn">{{ stats24h.errors }}</div>
          <div class="stat-label">错误数</div>
          <div class="stat-sub">状态码 ≥ 400</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon err"><AppIcon name="alert-circle" :size="18" /></div>
          <div class="stat-value err">{{ stats24h.server_errors }}</div>
          <div class="stat-label">服务端错误</div>
          <div class="stat-sub">状态码 ≥ 500</div>
        </div>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="audit-section">
      <div class="section-label">筛选条件</div>
      <div class="filter-card">
        <div class="filter-grid">
          <div class="field field-wide">
            <label>关键词</label>
            <input v-model="keyword" type="text" placeholder="姓名 / 学号 / 动作 / 路径" />
          </div>
          <div class="field">
            <label>方法</label>
            <select v-model="method">
              <option value="">全部</option>
              <option v-for="m in METHOD_OPTIONS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="field">
            <label>状态码</label>
            <select v-model="status">
              <option value="">全部</option>
              <option v-for="s in STATUS_OPTIONS" :key="s" :value="String(s)">{{ s }}</option>
            </select>
          </div>
          <div v-if="membersLoaded && members.length > 0" class="field">
            <label>成员</label>
            <select v-model="memberId">
              <option value="">全部成员</option>
              <option v-for="m in members" :key="m.id" :value="String(m.id)">
                {{ m.name }}（{{ m.student_id }}）
              </option>
            </select>
          </div>
          <div class="field">
            <label>开始日期</label>
            <input v-model="fromDate" type="date" />
          </div>
          <div class="field">
            <label>结束日期</label>
            <input v-model="toDate" type="date" />
          </div>
          <div class="field field-check">
            <label class="check-line">
              <input v-model="errorsOnly" type="checkbox" />
              <span>只看服务端错误（5xx）</span>
            </label>
          </div>
        </div>

        <div v-if="membersError" class="member-warn">
          <AppIcon name="alert-triangle" :size="14" />
          <span>成员筛选项加载失败（不影响其它筛选）</span>
          <BaseButton variant="text" size="sm" @click="loadMembers">重试</BaseButton>
        </div>

        <div class="filter-actions">
          <BaseButton variant="ghost" size="sm" :disabled="loading || !hasFilter" @click="resetFilters">
            重置筛选
          </BaseButton>
          <BaseButton variant="secondary" size="sm" :loading="loading" @click="reload(1)">刷新</BaseButton>
          <BaseButton variant="secondary" size="sm" :loading="exporting" @click="exportCsv">导出 CSV</BaseButton>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="audit-section">
      <div class="section-label">请求明细</div>
      <StateView
        :loading="loading"
        :error="error"
        :empty="rows.length === 0"
        loading-text="正在加载审计日志…"
        :empty-icon="hasFilter ? 'search' : 'clipboard'"
        :empty-variant="hasFilter ? 'filtered' : 'default'"
        :empty-title="hasFilter ? '没有符合条件的审计记录' : '还没有审计记录'"
        :empty-description="
          hasFilter
            ? '试试放宽筛选条件，或点「重置筛选」查看全部记录。'
            : '有用户访问接口后，这里会自动记录请求时间、操作人与状态码。'
        "
        @retry="reload(1)"
      >
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>姓名</th>
                <th>方法</th>
                <th>路径</th>
                <th>状态码</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in rows" :key="row.id">
                <tr class="clickable" @click="toggleRow(row.id)">
                  <td class="nowrap" data-label="时间">{{ formatTime(row.created_at) }}</td>
                  <td class="nowrap" data-label="姓名">{{ displayName(row) }}</td>
                  <td class="nowrap" data-label="方法"><span class="method-tag">{{ row.method || '—' }}</span></td>
                  <td class="path-cell" data-label="路径">{{ row.path || '—' }}</td>
                  <td class="nowrap" data-label="状态码">
                    <span class="status-tag" :class="statusClass(row.status_code)">{{ row.status_code ?? '—' }}</span>
                  </td>
                  <td class="nowrap" data-label="IP">{{ row.ip || '—' }}</td>
                </tr>
                <tr v-if="isExpanded(row.id)" :key="`detail-${row.id}`" class="detail-row">
                  <td colspan="6">
                    <div class="detail-item"><span class="detail-key">动作</span><span class="detail-val">{{ row.action || '—' }}</span></div>
                    <div class="detail-item"><span class="detail-key">完整路径</span><span class="detail-val mono">{{ row.path || '—' }}</span></div>
                    <div class="detail-item">
                      <span class="detail-key">用户</span>
                      <span class="detail-val">
                        {{ displayName(row) }}<template v-if="row.student_id"> · 学号 {{ row.student_id }}</template>
                      </span>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div class="pager">
          <BaseButton variant="ghost" size="sm" :disabled="loading || page <= 1" @click="prevPage">上一页</BaseButton>
          <span class="pager-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</span>
          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="loading || page >= totalPages"
            @click="nextPage"
          >
            下一页
          </BaseButton>
          <select class="pager-size" :value="String(pageSize)" :disabled="loading" @change="onPageSizeChange">
            <option v-for="size in PAGE_SIZES" :key="size" :value="String(size)">每页 {{ size }} 条</option>
          </select>
        </div>
      </StateView>
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

.audit-section { margin-bottom: 24px; }
.section-label {
  font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 8px;
}

/* ========== Stats ========== */
.stats-placeholder { font-size: var(--font-size-xs); color: var(--color-text-3); }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.stat-icon { color: var(--color-text-3); margin-bottom: 4px; }
.stat-icon.warn { color: var(--color-warning); }
.stat-icon.err { color: var(--color-error); }
.stat-value { font-size: 26px; font-weight: 700; color: var(--color-accent); }
.stat-value.warn { color: var(--color-warning); }
.stat-value.err { color: var(--color-error); }
.stat-label { font-size: var(--font-size-xs); color: var(--color-text-2); margin-top: 2px; }
.stat-sub { font-size: var(--font-size-2xs); color: var(--color-text-3); margin-top: 2px; }

/* ========== Filters ========== */
.filter-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.field label { font-size: var(--font-size-xs); color: var(--color-text-2); }
.field input[type='text'],
.field input[type='date'],
.field select {
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0 10px;
  font-size: var(--font-size-sm);
  background: var(--color-bg);
  color: var(--color-text);
  width: 100%;
  box-sizing: border-box;
}
.field input:focus,
.field select:focus { outline: none; border-color: var(--color-accent); }
.field-check { justify-content: flex-end; }
.check-line {
  display: flex; align-items: center; gap: 6px;
  font-size: var(--font-size-sm); color: var(--color-text-2); height: 36px; cursor: pointer;
}
.check-line input { width: 15px; height: 15px; accent-color: var(--color-accent); cursor: pointer; }

.member-warn {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-top: 10px; font-size: var(--font-size-xs); color: var(--color-warning);
}
.filter-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }

/* ========== Table ========== */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  min-width: 720px;
}
.data-table th,
.data-table td {
  text-align: left;
  padding: 8px 10px;
  font-size: var(--font-size-sm);
  border-bottom: 1px solid var(--color-border);
}
.data-table th {
  background: var(--color-surface-hover);
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}
.data-table td { color: var(--color-text); }
.data-table tbody tr:last-child td { border-bottom: none; }
.clickable { cursor: pointer; }
.clickable:hover td { background: var(--color-surface-hover); }
.nowrap { white-space: nowrap; }
.path-cell {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--color-text-2);
}

.method-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  background: var(--color-accent-bg);
  color: var(--color-accent);
}
.status-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
}
.status-tag.ok { background: var(--color-success-bg); color: var(--color-success); }
.status-tag.warn { background: var(--color-warning-bg); color: var(--color-warning); }
.status-tag.err { background: var(--color-error-bg); color: var(--color-error); }

.detail-row td { background: var(--color-bg); padding: 10px 14px; }
.detail-item { display: flex; gap: 10px; font-size: var(--font-size-xs); padding: 3px 0; }
.detail-key { flex-shrink: 0; width: 60px; color: var(--color-text-3); }
.detail-val { color: var(--color-text); word-break: break-all; }
.detail-val.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* ========== Pager ========== */
.pager {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
  margin-top: 12px;
}
.pager-info { font-size: var(--font-size-sm); color: var(--color-text-2); }
.pager-size {
  margin-left: auto;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0 8px;
  font-size: var(--font-size-sm);
  background: var(--color-surface);
  color: var(--color-text);
}

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: var(--font-size-lg); margin-bottom: 12px; }
  .stats-grid { gap: 8px; grid-template-columns: repeat(2, 1fr); }
  .stat-card { padding: 14px; }
  .stat-value { font-size: 22px; }
  .filter-grid { grid-template-columns: 1fr; }
  .filter-actions { display: grid; grid-template-columns: repeat(2, 1fr); }
  .filter-actions :deep(.btn) { width: 100%; }
  .pager { gap: 8px; }
  .pager-size { margin-left: 0; width: 100%; }
}

/* 窄屏：表格转卡片式列表，关键列（时间/姓名/状态码）保留，次要列换行展示 */
@media (max-width: 640px) {
  .table-wrap { overflow-x: visible; }
  .data-table { min-width: 0; box-shadow: none; background: transparent; }
  .data-table thead { display: none; }
  .data-table tbody tr.clickable {
    display: block;
    background: var(--color-surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-card);
    padding: 8px 12px;
    margin-bottom: 8px;
  }
  .data-table tbody tr.clickable:hover td { background: transparent; }
  .data-table td {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    border-bottom: none;
    padding: 3px 0;
    white-space: normal;
  }
  .data-table td::before {
    content: attr(data-label);
    flex: 0 0 auto;
    color: var(--color-text-3);
    font-size: var(--font-size-xs);
  }
  .path-cell { max-width: none; overflow: visible; white-space: normal; word-break: break-all; text-align: right; }
  .detail-row { display: block; }
  .detail-row td { display: block; border-radius: var(--radius-sm); margin-bottom: 8px; }
}
</style>
