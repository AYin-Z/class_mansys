<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAuditLog, listMembers } from '@/api/admin'
import { downloadFile } from '@/utils/request'
import { showToast } from '@/utils/ui'
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
const errorMsg = ref('')
const rows = ref<AuditRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(PAGE_SIZES[0])
const stats24h = ref({ all_count: 0, errors: 0, server_errors: 0 })
const expandedIds = ref<number[]>([])

/* ================= 成员下拉 ================= */
const members = ref<MemberOption[]>([])
const membersLoaded = ref(false)

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
  page.value = targetPage
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getAuditLog({
      ...buildQuery(),
      page: page.value,
      pageSize: pageSize.value
    })
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
      errorMsg.value = '审计日志加载失败，请稍后重试'
    }
  } catch (err) {
    rows.value = []
    total.value = 0
    errorMsg.value = err instanceof Error && err.message ? err.message : '审计日志加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function loadMembers() {
  try {
    const res = await listMembers({ page: 1, pageSize: 200 })
    if (res?.success) members.value = res.members || []
  } catch {
    // 成员下拉为可选功能，失败时静默降级
    members.value = []
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
  const params: Record<string, string> = { limit: '5000' }
  const q = buildQuery()
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === '') continue
    params[key] = String(value)
  }
  try {
    // 必须带 Authorization 头下载：window.open 不会带令牌（此前导出 100% 401）
    await downloadFile('/api/admin/audit/export', 'audit-log.csv', params)
  } catch (e: any) {
    showToast(e?.message || '导出失败', 'error')
  }
}
</script>

<template>
  <section>
    <h2>审计日志</h2>

    <!-- 近 24 小时统计 -->
    <div class="audit-section">
      <div class="section-label">近 24 小时</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-value">{{ stats24h.all_count }}</div>
          <div class="stat-label">请求总数</div>
          <div class="stat-sub">近 24 小时全部接口调用</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value warn">{{ stats24h.errors }}</div>
          <div class="stat-label">错误数</div>
          <div class="stat-sub">状态码 ≥ 400</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🚨</div>
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
        <div class="filter-actions">
          <button class="btn-sm ghost" :disabled="loading || !hasFilter" @click="resetFilters">重置筛选</button>
          <button class="btn-sm" :disabled="loading" @click="reload(1)">刷新</button>
          <button class="btn-sm" @click="exportCsv">导出 CSV</button>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="audit-section">
      <div class="section-label">请求明细</div>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="errorMsg" class="loading error-msg">{{ errorMsg }}</div>
      <div v-else-if="rows.length === 0" class="empty-msg">
        {{ hasFilter ? '没有符合条件的审计记录，试试放宽筛选条件' : '暂无审计记录' }}
      </div>
      <template v-else>
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
                  <td class="nowrap">{{ formatTime(row.created_at) }}</td>
                  <td class="nowrap">{{ displayName(row) }}</td>
                  <td class="nowrap"><span class="method-tag">{{ row.method || '—' }}</span></td>
                  <td class="path-cell">{{ row.path || '—' }}</td>
                  <td class="nowrap">
                    <span class="status-tag" :class="statusClass(row.status_code)">{{ row.status_code ?? '—' }}</span>
                  </td>
                  <td class="nowrap">{{ row.ip || '—' }}</td>
                </tr>
                <tr v-if="isExpanded(row.id)" :key="`detail-${row.id}`" class="detail-row">
                  <td :colspan="6">
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
          <button class="btn-sm ghost" :disabled="loading || page <= 1" @click="prevPage">上一页</button>
          <span class="pager-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</span>
          <button class="btn-sm ghost" :disabled="loading || page >= totalPages" @click="nextPage">下一页</button>
          <select class="pager-size" :value="String(pageSize)" @change="onPageSizeChange">
            <option v-for="size in PAGE_SIZES" :key="size" :value="String(size)">每页 {{ size }} 条</option>
          </select>
        </div>
      </template>
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

.audit-section { margin-bottom: 24px; }
.section-label {
  font-size: 12px; font-weight: 600; color: var(--color-text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 8px;
}

/* ========== Stats ========== */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.stat-icon { font-size: 22px; margin-bottom: 4px; }
.stat-value { font-size: 26px; font-weight: 700; color: var(--color-accent); }
.stat-value.warn { color: var(--color-warning); }
.stat-value.err { color: #e5484d; }
.stat-label { font-size: 12px; color: var(--color-text-2); margin-top: 2px; }
.stat-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }

/* ========== Filters ========== */
.filter-card {
  background: var(--color-surface);
  border-radius: var(--radius-md, 12px);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.field label { font-size: 12px; color: var(--color-text-2); }
.field input[type='text'],
.field input[type='date'],
.field select {
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
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
  font-size: 13px; color: var(--color-text-2); height: 36px; cursor: pointer;
}
.check-line input { width: 15px; height: 15px; accent-color: var(--color-accent); cursor: pointer; }

.filter-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }

.btn-sm {
  padding: 8px 16px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.1s;
}
.btn-sm:hover:not(:disabled) { opacity: 0.88; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm.ghost {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  border: 1px solid var(--color-border);
}

/* ========== Table ========== */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  min-width: 720px;
}
.data-table th,
.data-table td {
  text-align: left;
  padding: 8px 10px;
  font-size: 13px;
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
  border-radius: 999px;
  font-size: 12px;
  background: var(--color-accent-bg);
  color: var(--color-accent);
}
.status-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.status-tag.ok { background: rgba(48, 164, 108, 0.14); color: #2f9e63; }
.status-tag.warn { background: rgba(245, 165, 36, 0.16); color: #b5730f; }
.status-tag.err { background: rgba(229, 72, 77, 0.14); color: #cf3238; }

.detail-row td { background: var(--color-bg); padding: 10px 14px; }
.detail-item { display: flex; gap: 10px; font-size: 12px; padding: 3px 0; }
.detail-key { flex-shrink: 0; width: 60px; color: var(--color-text-3); }
.detail-val { color: var(--color-text); word-break: break-all; }
.detail-val.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* ========== Pager ========== */
.pager {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
  margin-top: 12px;
}
.pager-info { font-size: 13px; color: var(--color-text-2); }
.pager-size {
  margin-left: auto;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: var(--color-surface);
  color: var(--color-text);
}

/* ========== States ========== */
.loading { padding: 40px; text-align: center; color: var(--color-text-2); font-size: 14px; }
.error-msg { color: var(--color-warning); }
.empty-msg {
  background: var(--color-surface);
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-card);
  text-align: center;
  padding: 32px 16px;
  color: var(--color-text-3);
  font-size: 13px;
}

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: 18px; margin-bottom: 12px; }
  .stats-grid { gap: 8px; grid-template-columns: repeat(2, 1fr); }
  .stat-card { padding: 14px; }
  .stat-value { font-size: 22px; }
  .filter-grid { grid-template-columns: 1fr; }
  .filter-actions .btn-sm { flex: 1; }
  .pager { gap: 8px; }
  .pager-size { margin-left: 0; width: 100%; }
}
</style>
