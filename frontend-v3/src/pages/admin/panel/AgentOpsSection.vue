<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getAgentPanel, revokeAnyToken } from '@/api/admin'
import type { AgentPanelData } from '@/api/admin'
import { showConfirm, showToast } from '@/utils/ui'

type TokenRow = AgentPanelData['tokens'][number]

const loading = ref(true)
const loadFailed = ref(false)
const data = ref<AgentPanelData | null>(null)
const revokingId = ref<number | null>(null)

/** 模型模式中文说明 */
const LLM_MODE_LABELS: Record<string, string> = {
  auto: '自动',
  live: '真实模型',
  mock: '模拟',
  off: '关闭',
}

const llmMode = computed(() => data.value?.llmMode || '')
const llmModeLabel = computed(() => {
  const mode = llmMode.value
  if (!mode) return '未知'
  return LLM_MODE_LABELS[mode] || mode
})

const quota = computed(() => data.value?.quota ?? { messages24h: 0, users24h: 0, dailyLimitPerUser: 0 })

const wechat = computed(() => data.value?.wechat ?? { worker: '', configured: false, credentialsFile: '' })
const wechatWorkerLabel = computed(() => {
  const worker = wechat.value.worker || ''
  if (worker === 'active') return '运行中'
  if (!worker) return '未知'
  return worker
})
const wechatWorkerOk = computed(() => wechat.value.worker === 'active')
const wechatCredentialLabel = computed(() =>
  wechat.value.configured ? '已配置凭证' : '未扫码连接'
)

/** 近 14 天趋势 */
const daily = computed(() => (data.value?.daily ?? []).slice(-14))
const maxMessages = computed(() => Math.max(1, ...daily.value.map((d) => d.messages || 0)))

/** MCP 令牌（最多 100 条） */
const tokens = computed(() => (data.value?.tokens ?? []).slice(0, 100))

/** 微信绑定（最多 100 条） */
const bindings = computed(() => (data.value?.bindings ?? []).slice(0, 100))

/** 工具调用 Top10 */
const topTools = computed(() => (data.value?.topTools ?? []).slice(0, 10))
const maxToolCount = computed(() => Math.max(1, ...topTools.value.map((t) => t.count || 0)))

function barWidth(value: number, max: number): number {
  if (!value || value <= 0) return 0
  return Math.max(2, Math.round((value / max) * 100))
}

function fmtTime(value: string | null | undefined): string {
  if (!value) return '—'
  return value.slice(0, 16).replace('T', ' ')
}

function tokenOwner(tk: TokenRow): string {
  return tk.user_name || tk.student_id || '未知用户'
}

function tokenPrefix(tk: TokenRow): string {
  return tk.prefix || '—'
}

function tokenRemark(tk: TokenRow): string {
  return tk.name || '—'
}

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    const res = await getAgentPanel()
    if (res && res.success) {
      data.value = res.data
    } else {
      data.value = null
      loadFailed.value = true
      showToast('加载智能体运行数据失败', 'error')
    }
  } catch (e) {
    data.value = null
    loadFailed.value = true
    showToast((e as Error).message || '加载智能体运行数据失败', 'error')
  } finally {
    loading.value = false
  }
}

async function handleRevoke(tk: TokenRow) {
  const owner = tokenOwner(tk)
  const ok = await showConfirm('吊销令牌', `确定吊销「${owner}」的令牌吗？吊销后该令牌将立即失效。`)
  if (!ok) return
  revokingId.value = tk.id
  try {
    const res = await revokeAnyToken(tk.id)
    if (res && res.success === false) {
      showToast(res.message || '吊销失败', 'error')
      return
    }
    showToast('令牌已吊销')
    await load()
  } catch (e) {
    showToast((e as Error).message || '吊销失败', 'error')
  } finally {
    revokingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <section>
    <h2>智能体运行</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="loadFailed || !data" class="loading">暂无数据，请稍后重试</div>
    <template v-else>
      <!-- 运行状态 -->
      <div class="ops-section">
        <div class="section-label">运行状态</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🤖</div>
            <div class="stat-value">{{ llmModeLabel }}</div>
            <div class="stat-label">模型模式</div>
            <div class="stat-sub">当前值：{{ llmMode || '未知' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💬</div>
            <div class="stat-value">{{ quota.messages24h }}</div>
            <div class="stat-label">近 24h 消息数</div>
            <div class="stat-sub">最近一天的消息总量</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">👤</div>
            <div class="stat-value">{{ quota.users24h }}</div>
            <div class="stat-label">近 24h 活跃人数</div>
            <div class="stat-sub">最近一天的使用人数</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">{{ quota.dailyLimitPerUser }}</div>
            <div class="stat-label">每人每日上限</div>
            <div class="stat-sub">单用户每日消息额度</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📱</div>
            <div class="stat-value">
              <span :class="wechatWorkerOk ? 'dot-ok' : 'dot-off'"></span>{{ wechatWorkerLabel }}
            </div>
            <div class="stat-label">微信通道</div>
            <div class="stat-sub" :class="{ 'sub-warn': !wechat.configured }">{{ wechatCredentialLabel }}</div>
          </div>
        </div>
      </div>

      <!-- 近 14 天使用趋势 -->
      <div class="ops-section">
        <div class="section-label">近 14 天使用趋势</div>
        <div class="ops-card">
          <div v-if="daily.length === 0" class="empty-msg">暂无使用数据</div>
          <div v-else class="trend-list">
            <div v-for="d in daily" :key="d.day" class="trend-row">
              <span class="trend-day">{{ d.day }}</span>
              <div class="trend-track">
                <div class="trend-fill" :style="{ width: barWidth(d.messages, maxMessages) + '%' }"></div>
              </div>
              <span class="trend-num">{{ d.messages }} 条</span>
              <span class="trend-num trend-sub">会话 {{ d.conversations }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- MCP 令牌 -->
      <div class="ops-section">
        <div class="section-label">MCP 令牌</div>
        <div class="ops-card">
          <div v-if="tokens.length === 0" class="empty-msg">暂无令牌</div>
          <div v-else class="table-scroll">
            <table class="ops-table">
              <thead>
                <tr>
                  <th>使用者</th>
                  <th>备注</th>
                  <th>前缀</th>
                  <th>权限</th>
                  <th>最近使用</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tk in tokens" :key="tk.id">
                  <td>
                    <div class="cell-main">{{ tokenOwner(tk) }}</div>
                    <div v-if="tk.student_id" class="cell-sub">{{ tk.student_id }}</div>
                  </td>
                  <td>{{ tokenRemark(tk) }}</td>
                  <td class="cell-mono">{{ tokenPrefix(tk) }}</td>
                  <td>
                    <span class="tag" :class="tk.allow_write ? 'tag-write' : 'tag-read'">
                      {{ tk.allow_write ? '读写' : '只读' }}
                    </span>
                  </td>
                  <td class="cell-time">{{ fmtTime(tk.last_used_at) }}</td>
                  <td>
                    <span v-if="tk.revoked_at" class="tag tag-revoked">已吊销</span>
                    <span v-else class="tag tag-active">正常</span>
                  </td>
                  <td>
                    <button
                      v-if="!tk.revoked_at"
                      class="btn-sm btn-danger"
                      :disabled="revokingId === tk.id"
                      @click="handleRevoke(tk)"
                    >
                      {{ revokingId === tk.id ? '处理中...' : '吊销' }}
                    </button>
                    <span v-else class="cell-sub">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 微信绑定 -->
      <div class="ops-section">
        <div class="section-label">微信绑定</div>
        <div class="ops-card">
          <div v-if="bindings.length === 0" class="empty-msg">暂无绑定</div>
          <div v-else class="table-scroll">
            <table class="ops-table">
              <thead>
                <tr>
                  <th>渠道</th>
                  <th>用户</th>
                  <th>外部 ID</th>
                  <th>状态</th>
                  <th>绑定时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in bindings" :key="b.id">
                  <td class="cell-main">{{ b.channel || '—' }}</td>
                  <td>
                    <div class="cell-main">{{ b.user_name || b.display_name || '未知用户' }}</div>
                    <div v-if="b.class_id" class="cell-sub">{{ b.class_id }}</div>
                  </td>
                  <td class="cell-mono">{{ b.external_id || '—' }}</td>
                  <td>
                    <span class="tag" :class="b.status === 'active' ? 'tag-active' : 'tag-off'">
                      {{ b.status === 'active' ? '已绑定' : b.status || '未知' }}
                    </span>
                  </td>
                  <td class="cell-time">{{ fmtTime(b.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 工具调用 Top10 -->
      <div class="ops-section">
        <div class="section-label">工具调用 Top10</div>
        <div class="ops-card">
          <div v-if="topTools.length === 0" class="empty-msg">暂无数据</div>
          <div v-else class="bar-list">
            <div v-for="t in topTools" :key="t.tool" class="bar-item">
              <span class="bar-label">{{ t.tool }}</span>
              <span class="bar-count">{{ t.count }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: barWidth(t.count, maxToolCount) + '%' }"></div>
              </div>
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

.ops-section { margin-bottom: 24px; }
.section-label {
  font-size: 12px; font-weight: 600; color: var(--color-text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.ops-card {
  background: var(--color-surface);
  border-radius: var(--radius-md, 12px);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.loading { padding: 40px; text-align: center; color: var(--color-text-2); font-size: 14px; }
.empty-msg { text-align: center; padding: 20px; color: var(--color-text-3); font-size: 13px; }

/* ========== Stats ========== */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.stat-icon { font-size: 22px; margin-bottom: 4px; }
.stat-value {
  font-size: 22px; font-weight: 700; color: var(--color-accent);
  display: flex; align-items: center; gap: 6px;
}
.stat-label { font-size: 12px; color: var(--color-text-2); margin-top: 2px; }
.stat-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }
.sub-warn { color: var(--color-warning); }
.dot-ok, .dot-off {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
}
.dot-ok { background: var(--color-accent); }
.dot-off { background: var(--color-text-3); }

/* ========== Trend ========== */
.trend-list { display: flex; flex-direction: column; gap: 8px; }
.trend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.trend-day { width: 84px; flex-shrink: 0; color: var(--color-text-2); }
.trend-track {
  flex: 1; min-width: 60px; height: 10px;
  background: var(--color-surface-hover);
  border-radius: 5px; overflow: hidden;
}
.trend-fill {
  height: 100%; background: var(--color-accent);
  border-radius: 5px; transition: width 0.2s;
}
.trend-num { width: 64px; flex-shrink: 0; color: var(--color-text); text-align: right; }
.trend-sub { color: var(--color-text-3); }

/* ========== Table ========== */
.table-scroll { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.ops-table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 13px; }
.ops-table th {
  text-align: left; font-size: 12px; font-weight: 600;
  color: var(--color-text-3); padding: 8px 10px;
  border-bottom: 1px solid var(--color-border); white-space: nowrap;
}
.ops-table td {
  padding: 10px; color: var(--color-text);
  border-bottom: 1px solid var(--color-border); vertical-align: middle;
}
.ops-table tr:last-child td { border-bottom: none; }
.ops-table tbody tr:hover { background: var(--color-surface-hover); }
.cell-main { color: var(--color-text); }
.cell-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }
.cell-time { color: var(--color-text-2); white-space: nowrap; }
.cell-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; color: var(--color-text-2);
}

/* tags */
.tag {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; white-space: nowrap;
}
.tag-write { background: var(--color-accent-bg); color: var(--color-accent); }
.tag-read { background: var(--color-surface-hover); color: var(--color-text-2); }
.tag-active { background: var(--color-accent-bg); color: var(--color-accent); }
.tag-off { background: var(--color-surface-hover); color: var(--color-text-3); }
.tag-revoked { background: var(--color-surface-hover); color: var(--color-warning); }

/* buttons */
.btn-sm {
  padding: 6px 12px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger { background: var(--color-warning); }

/* ========== Bars ========== */
.bar-list { display: flex; flex-direction: column; gap: 8px; }
.bar-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.bar-label {
  width: 120px; flex-shrink: 0; color: var(--color-text);
  text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bar-count { width: 40px; flex-shrink: 0; color: var(--color-text-2); font-size: 12px; }
.bar-track {
  flex: 1; min-width: 60px; height: 8px;
  background: var(--color-surface-hover);
  border-radius: 4px; overflow: hidden;
}
.bar-fill { height: 100%; background: var(--color-accent); border-radius: 4px; min-width: 2px; }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: 18px; margin-bottom: 12px; }
  .stats-grid { gap: 8px; grid-template-columns: repeat(2, 1fr); }
  .stat-card { padding: 14px; }
  .stat-value { font-size: 18px; }
  .ops-card { padding: 12px; }
  .trend-day { width: 66px; font-size: 11px; }
  .trend-num { width: 56px; font-size: 11px; }
  .bar-label { width: 84px; font-size: 12px; }
}
</style>
