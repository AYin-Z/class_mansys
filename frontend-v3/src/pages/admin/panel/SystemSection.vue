<script setup lang="ts">
/**
 * 系统状态（运维面板）
 * 自包含：自行拉取 /api/admin/system/status，展示服务状态 / 数据库 / 系统开关 /
 * 备份 / 近 24h 错误 / 数据导出 / 定时任务 / 每日汇总文件。
 */
import { computed, onMounted, ref } from 'vue'
import { getSystemStatus, runBackup, rosterCsvUrl, rosterXlsxUrl } from '@/api/admin'
import type { SystemStatus } from '@/api/admin'

interface BackupFile {
  name: string
  size: number
  mtime: string
}

interface FlagEntry {
  key: string
  label: string
  value: string | boolean
}

/** 开关中文说明（键名原样展示） */
const FLAG_LABELS: Record<string, string> = {
  AGENT_LLM_MODE: '对话模型模式',
  UPLOAD_AUTH_MODE: '上传鉴权模式',
  llmConfigured: '大模型密钥',
  smtpConfigured: '邮件服务',
  digestTo: '每日汇总收件人',
  wechatConfigured: '微信通道',
  apkDir: 'APK 目录',
  uploadDir: '上传目录'
}

const MAX_BACKUPS = 10

const status = ref<SystemStatus | null>(null)
const loading = ref(true)
const error = ref('')

const backupRunning = ref(false)
const backupOutput = ref('')
const backupError = ref('')

// ========== 取数 ==========
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getSystemStatus()
    status.value = res?.data || null
    if (!status.value) error.value = '未获取到系统状态数据'
  } catch (e) {
    status.value = null
    error.value = e instanceof Error ? e.message : '系统状态加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ========== 派生数据（均有兜底，模板无需判空） ==========
const processInfo = computed(
  () =>
    status.value?.process || {
      node: '',
      uptimeSec: 0,
      memoryMb: 0,
      pid: 0,
      env: '',
      port: 0,
      service: { ok: false, out: '', err: '' }
    }
)

const databaseInfo = computed(
  () =>
    status.value?.database || {
      name: '',
      tables: 0,
      migrationsApplied: 0,
      lastMigration: null
    }
)

const serviceInfo = computed(() => processInfo.value.service || { ok: false, out: '', err: '' })

const flagEntries = computed<FlagEntry[]>(() => {
  const flags = status.value?.flags || {}
  return Object.entries(flags).map(([key, value]) => ({
    key,
    label: FLAG_LABELS[key] || '系统开关',
    value
  }))
})

const backups = computed<BackupFile[]>(() =>
  [...(status.value?.backups || [])]
    .sort((a, b) => String(b.mtime || '').localeCompare(String(a.mtime || '')))
    .slice(0, MAX_BACKUPS)
)

const digests = computed<BackupFile[]>(() => status.value?.digests || [])

const errorStats = computed(() => status.value?.errors || { count24h: 0, byPath: [], topPaths: [] })

const timers = computed<string[]>(() => status.value?.timers || [])

// ========== 格式化 ==========
function formatUptime(sec: number): string {
  const total = Math.max(0, Math.floor(Number(sec) || 0))
  if (total < 60) return `${total}秒`
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${days}天${hours}小时${minutes}分`
}

function formatSize(size: number): string {
  const kb = (Number(size) || 0) / 1024
  return `${kb.toFixed(1)} KB`
}

function formatTime(value: string): string {
  if (!value) return '—'
  return String(value).slice(0, 16).replace('T', ' ')
}

// ========== 备份 ==========
async function doBackup() {
  if (backupRunning.value) return
  backupRunning.value = true
  backupError.value = ''
  try {
    const res = await runBackup()
    backupOutput.value = res?.data?.output || res?.message || '备份已完成'
    await load()
  } catch (e) {
    backupOutput.value = ''
    backupError.value = e instanceof Error ? e.message : '备份失败，请稍后重试'
  } finally {
    backupRunning.value = false
  }
}

// ========== 导出 ==========
function exportRoster(kind: 'xlsx' | 'csv') {
  const url = kind === 'xlsx' ? rosterXlsxUrl() : rosterCsvUrl()
  if (url) window.open(url, '_blank')
}

defineExpose({ refresh: load })
</script>

<template>
  <section>
    <h2>系统状态</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error-box">{{ error }}</div>
    <template v-else>
      <div class="sys-grid">
        <!-- 1. 服务状态 -->
        <div class="sys-card">
          <div class="card-title">🖥️ 服务状态</div>
          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">运行时长</span>
              <span class="kv-value">{{ formatUptime(processInfo.uptimeSec) }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">内存占用</span>
              <span class="kv-value">{{ processInfo.memoryMb }} MB</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">Node 版本</span>
              <span class="kv-value">{{ processInfo.node || '—' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">运行环境</span>
              <span class="kv-value">{{ processInfo.env || '—' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">端口</span>
              <span class="kv-value">{{ processInfo.port || '—' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">进程 PID</span>
              <span class="kv-value">{{ processInfo.pid || '—' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">systemd 状态</span>
              <span class="kv-value">
                <span :class="['badge', serviceInfo.ok ? 'badge-ok' : 'badge-bad']">
                  {{ serviceInfo.ok ? '✅ 运行中' : '❌ 异常' }}
                </span>
              </span>
            </div>
          </div>
          <pre v-if="serviceInfo.out || serviceInfo.err" class="pre-box">{{
            serviceInfo.err || serviceInfo.out
          }}</pre>
        </div>

        <!-- 2. 数据库 -->
        <div class="sys-card">
          <div class="card-title">🗄️ 数据库</div>
          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">库名</span>
              <span class="kv-value">{{ databaseInfo.name || '—' }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">数据表数</span>
              <span class="kv-value">{{ databaseInfo.tables }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">已应用迁移</span>
              <span class="kv-value">{{ databaseInfo.migrationsApplied }} 条</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">最后迁移</span>
              <span class="kv-value">
                <template v-if="databaseInfo.lastMigration">
                  {{ databaseInfo.lastMigration.id }} ·
                  {{ formatTime(databaseInfo.lastMigration.applied_at) }}
                </template>
                <template v-else>暂无迁移记录</template>
              </span>
            </div>
          </div>
        </div>

        <!-- 3. 系统开关 -->
        <div class="sys-card">
          <div class="card-title">🎛️ 系统开关</div>
          <div v-if="flagEntries.length === 0" class="empty-msg">暂无开关配置</div>
          <div v-else class="kv-list">
            <div v-for="item in flagEntries" :key="item.key" class="kv-row">
              <span class="kv-key">
                <code class="flag-key">{{ item.key }}</code>
                <span class="flag-desc">{{ item.label }}</span>
              </span>
              <span class="kv-value">
                <template v-if="typeof item.value === 'boolean'">
                  <span :class="['badge', item.value ? 'badge-ok' : 'badge-bad']">
                    {{ item.value ? '✅' : '❌' }}
                  </span>
                </template>
                <template v-else>{{ item.value || '—' }}</template>
              </span>
            </div>
          </div>
        </div>

        <!-- 4. 备份 -->
        <div class="sys-card">
          <div class="card-title">💾 备份</div>
          <div class="card-actions">
            <button class="btn-primary" :disabled="backupRunning" @click="doBackup">
              {{ backupRunning ? '备份中…' : '立即备份' }}
            </button>
          </div>
          <div v-if="backups.length === 0" class="empty-msg">暂无备份文件</div>
          <div v-else class="kv-list">
            <div v-for="file in backups" :key="file.name" class="kv-row">
              <span class="kv-key mono">{{ file.name }}</span>
              <span class="kv-value">
                {{ formatSize(file.size) }} · {{ formatTime(file.mtime) }}
              </span>
            </div>
          </div>
          <div v-if="backupError" class="error-box inline">{{ backupError }}</div>
          <pre v-if="backupOutput" class="pre-box">{{ backupOutput }}</pre>
        </div>

        <!-- 5. 近 24h 错误 -->
        <div class="sys-card wide">
          <div class="card-title">
            ⚠️ 近 24h 错误
            <span class="count-badge">{{ errorStats.count24h }}</span>
          </div>
          <div v-if="errorStats.byPath.length === 0" class="empty-msg">近 24 小时无 5xx 错误</div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>路径</th>
                <th class="col-method">方法</th>
                <th class="col-count">次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in errorStats.byPath" :key="`${row.method}-${row.path}-${idx}`">
                <td class="mono">{{ row.path }}</td>
                <td class="col-method">
                  <span class="method-tag">{{ row.method }}</span>
                </td>
                <td class="col-count">{{ row.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 6. 数据导出 -->
        <div class="sys-card">
          <div class="card-title">📤 数据导出</div>
          <div class="card-actions">
            <button class="btn-primary" @click="exportRoster('xlsx')">导出名册 Excel</button>
            <button class="btn-ghost" @click="exportRoster('csv')">导出名册 CSV</button>
          </div>
          <div class="hint">导出链接已携带访问令牌，将直接开始下载。</div>
        </div>

        <!-- 7. 定时任务 -->
        <div class="sys-card">
          <div class="card-title">⏰ 定时任务</div>
          <div v-if="timers.length === 0" class="empty-msg">暂无定时任务</div>
          <pre v-else class="pre-box">{{ timers.join('\n') }}</pre>
        </div>

        <!-- 8. 每日汇总文件 -->
        <div class="sys-card">
          <div class="card-title">📄 每日汇总文件</div>
          <div v-if="digests.length === 0" class="empty-msg">暂无每日汇总文件</div>
          <div v-else class="kv-list">
            <div v-for="file in digests" :key="file.name" class="kv-row">
              <span class="kv-key mono">{{ file.name }}</span>
              <span class="kv-value">
                {{ formatTime(file.mtime) }}
                <span class="muted">· {{ formatSize(file.size) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px;
}

.sys-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  align-items: start;
}
.sys-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 12px);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  min-width: 0;
}
.sys-card.wide {
  grid-column: 1 / -1;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 9px;
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

/* ========== 键值行 ========== */
.kv-list {
  display: flex;
  flex-direction: column;
}
.kv-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);
}
.kv-row:last-child {
  border-bottom: none;
}
.kv-key {
  color: var(--color-text-2);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.kv-value {
  color: var(--color-text);
  text-align: right;
  word-break: break-all;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.flag-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--color-text);
  background: var(--color-surface-hover);
  border-radius: 4px;
  padding: 1px 5px;
}
.flag-desc {
  font-size: 11px;
  color: var(--color-text-3);
}
.muted {
  color: var(--color-text-3);
}

/* ========== 标记 ========== */
.badge {
  display: inline-block;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 9px;
  white-space: nowrap;
}
.badge-ok {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}
.badge-bad {
  background: var(--color-surface-hover);
  color: var(--color-warning);
}

/* ========== 按钮 ========== */
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.btn-primary,
.btn-ghost {
  font-size: 13px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    opacity 0.1s,
    background 0.1s;
}
.btn-primary {
  border: none;
  background: var(--color-accent);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  opacity: 0.88;
}
.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-ghost {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
.btn-ghost:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.hint {
  font-size: 11px;
  color: var(--color-text-3);
}

/* ========== 表格 ========== */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  text-align: left;
  font-weight: 600;
  color: var(--color-text-3);
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 11px;
}
.data-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  word-break: break-all;
}
.data-table tr:last-child td {
  border-bottom: none;
}
.col-method {
  width: 70px;
}
.col-count {
  width: 60px;
  text-align: right;
}
.method-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-bg);
  border-radius: 4px;
  padding: 1px 6px;
}

/* ========== 代码块 / 状态 ========== */
.pre-box {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-2);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow: auto;
}
.loading {
  padding: 40px;
  text-align: center;
  color: var(--color-text-2);
  font-size: 14px;
}
.empty-msg {
  padding: 14px 0;
  text-align: center;
  color: var(--color-text-3);
  font-size: 12px;
}
.error-box {
  padding: 14px;
  border-radius: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-warning);
  font-size: 13px;
  text-align: center;
}
.error-box.inline {
  margin-top: 8px;
  padding: 10px;
  text-align: left;
  font-size: 12px;
}

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 {
    font-size: 18px;
    margin-bottom: 12px;
  }
  .sys-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .sys-card {
    padding: 12px;
  }
  .kv-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .kv-value {
    text-align: left;
  }
  .col-count {
    text-align: left;
  }
}
</style>
