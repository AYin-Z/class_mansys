<script setup lang="ts">
/**
 * 智能体运行 / 渠道
 *
 * 2026-09 修复：
 *  - 加载失败此前只有一行「暂无数据，请稍后重试」且没有入口，现在 error 交给
 *    StateView 渲染错误态 + 「重试」按钮
 *  - 吊销令牌：showConfirm 补 danger + 后果说明（对象 + 动作 + 后果），执行中防重
 *  - emoji 图标 → AppIcon；按钮 → BaseButton；色值 → 令牌
 *  - 窄屏隐藏次要列，避免整页横向溢出
 */
import { computed, onMounted, ref } from 'vue'
import { getAgentPanel, revokeAnyToken } from '@/api/admin'
import type { AgentPanelData } from '@/api/admin'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

type TokenRow = AgentPanelData['tokens'][number]

const loading = ref(true)
/** 错误对象：有值即渲染错误态 + 重试 */
const error = ref<unknown>(null)
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
  error.value = null
  try {
    const res = await getAgentPanel()
    if (res && res.success) {
      data.value = res.data
    } else {
      data.value = null
      error.value = new Error('加载智能体运行数据失败，请稍后重试')
    }
  } catch (e) {
    data.value = null
    error.value = e
  } finally {
    loading.value = false
  }
}

async function handleRevoke(tk: TokenRow) {
  const owner = tokenOwner(tk)
  const ok = await showConfirm(
    '吊销 MCP 令牌',
    `确定吊销「${owner}」的 MCP 令牌（${tokenPrefix(tk)}）？`,
    {
      confirmText: '吊销令牌',
      danger: true,
      hint: '吊销后该令牌立即失效，正在使用它的客户端会立刻无法调用；此操作不可撤销，需要重新生成令牌。',
    }
  )
  if (!ok) return
  revokingId.value = tk.id
  try {
    const res = await revokeAnyToken(tk.id)
    if (res && res.success === false) {
      showToast(res.message || '吊销失败', 'error')
      return
    }
    showToast('令牌已吊销', 'success')
    await load()
  } catch (e) {
    toastIfNotNotified(e, '吊销失败，请稍后重试')
  } finally {
    revokingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <section>
    <h2>智能体运行</h2>

    <StateView
      :loading="loading"
      :error="error"
      loading-text="正在加载智能体运行数据…"
      @retry="load"
    >
      <template v-if="data">
        <!-- 运行状态 -->
        <div class="ops-section">
          <div class="section-label">运行状态</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon"><AppIcon name="robot" :size="18" /></div>
              <div class="stat-value">{{ llmModeLabel }}</div>
              <div class="stat-label">模型模式</div>
              <div class="stat-sub">当前值：{{ llmMode || '未知' }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><AppIcon name="message-circle" :size="18" /></div>
              <div class="stat-value">{{ quota.messages24h }}</div>
              <div class="stat-label">近 24h 消息数</div>
              <div class="stat-sub">最近一天的消息总量</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><AppIcon name="user" :size="18" /></div>
              <div class="stat-value">{{ quota.users24h }}</div>
              <div class="stat-label">近 24h 活跃人数</div>
              <div class="stat-sub">最近一天的使用人数</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><AppIcon name="chart" :size="18" /></div>
              <div class="stat-value">{{ quota.dailyLimitPerUser }}</div>
              <div class="stat-label">每人每日上限</div>
              <div class="stat-sub">单用户每日消息额度</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><AppIcon name="phone" :size="18" /></div>
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
            <div v-if="daily.length === 0" class="empty-msg">
              近 14 天没有助手消息记录，说明还没有人通过助手提问。
            </div>
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
            <div v-if="tokens.length === 0" class="empty-msg">
              还没有人创建 MCP 令牌；学员在助手页生成令牌后会显示在这里，可随时吊销。
            </div>
            <div v-else class="table-scroll">
              <table class="ops-table">
                <thead>
                  <tr>
                    <th>使用者</th>
                    <th class="col-optional">备注</th>
                    <th class="col-optional">前缀</th>
                    <th>权限</th>
                    <th class="col-optional">最近使用</th>
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
                    <td class="col-optional">{{ tokenRemark(tk) }}</td>
                    <td class="cell-mono col-optional">{{ tokenPrefix(tk) }}</td>
                    <td>
                      <span class="tag" :class="tk.allow_write ? 'tag-write' : 'tag-read'">
                        {{ tk.allow_write ? '读写' : '只读' }}
                      </span>
                    </td>
                    <td class="cell-time col-optional">{{ fmtTime(tk.last_used_at) }}</td>
                    <td>
                      <span v-if="tk.revoked_at" class="tag tag-revoked">已吊销</span>
                      <span v-else class="tag tag-active">正常</span>
                    </td>
                    <td>
                      <BaseButton
                        v-if="!tk.revoked_at"
                        variant="danger"
                        size="sm"
                        :loading="revokingId === tk.id"
                        :disabled="revokingId !== null && revokingId !== tk.id"
                        @click="handleRevoke(tk)"
                      >
                        吊销
                      </BaseButton>
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
            <div v-if="bindings.length === 0" class="empty-msg">
              还没有用户绑定微信；绑定后可在微信里直接使用办事助手。
            </div>
            <div v-else class="table-scroll">
              <table class="ops-table">
                <thead>
                  <tr>
                    <th>渠道</th>
                    <th>用户</th>
                    <th class="col-optional">外部 ID</th>
                    <th>状态</th>
                    <th class="col-optional">绑定时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in bindings" :key="b.id">
                    <td class="cell-main">{{ b.channel || '—' }}</td>
                    <td>
                      <div class="cell-main">{{ b.user_name || b.display_name || '未知用户' }}</div>
                      <div v-if="b.class_id" class="cell-sub">{{ b.class_id }}</div>
                    </td>
                    <td class="cell-mono col-optional">{{ b.external_id || '—' }}</td>
                    <td>
                      <span class="tag" :class="b.status === 'active' ? 'tag-active' : 'tag-off'">
                        {{ b.status === 'active' ? '已绑定' : b.status || '未知' }}
                      </span>
                    </td>
                    <td class="cell-time col-optional">{{ fmtTime(b.created_at) }}</td>
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
            <div v-if="topTools.length === 0" class="empty-msg">
              暂无工具调用记录；助手调用工具后会在这里按次数排序。
            </div>
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

.ops-section { margin-bottom: 24px; }
.section-label {
  font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.ops-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.empty-msg { text-align: center; padding: 20px; color: var(--color-text-3); font-size: var(--font-size-sm); line-height: 1.6; }

/* ========== Stats ========== */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.stat-icon { color: var(--color-text-3); margin-bottom: 4px; }
.stat-value {
  font-size: 22px; font-weight: 700; color: var(--color-accent);
  display: flex; align-items: center; gap: 6px;
}
.stat-label { font-size: var(--font-size-xs); color: var(--color-text-2); margin-top: 2px; }
.stat-sub { font-size: var(--font-size-2xs); color: var(--color-text-3); margin-top: 2px; }
.sub-warn { color: var(--color-warning); }
.dot-ok, .dot-off {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
}
.dot-ok { background: var(--color-success); }
.dot-off { background: var(--color-text-3); }

/* ========== Trend ========== */
.trend-list { display: flex; flex-direction: column; gap: 8px; }
.trend-row { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-xs); }
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
.ops-table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: var(--font-size-sm); }
.ops-table th {
  text-align: left; font-size: var(--font-size-xs); font-weight: 600;
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
.cell-sub { font-size: var(--font-size-2xs); color: var(--color-text-3); margin-top: 2px; }
.cell-time { color: var(--color-text-2); white-space: nowrap; }
.cell-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--font-size-xs); color: var(--color-text-2);
}

/* tags */
.tag {
  display: inline-block; padding: 2px 8px; border-radius: var(--radius-full);
  font-size: var(--font-size-2xs); white-space: nowrap;
}
.tag-write { background: var(--color-accent-bg); color: var(--color-accent); }
.tag-read { background: var(--color-surface-hover); color: var(--color-text-2); }
.tag-active { background: var(--color-success-bg); color: var(--color-success); }
.tag-off { background: var(--color-surface-hover); color: var(--color-text-3); }
.tag-revoked { background: var(--color-surface-hover); color: var(--color-warning); }

/* ========== Bars ========== */
.bar-list { display: flex; flex-direction: column; gap: 8px; }
.bar-item { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm); }
.bar-label {
  width: 120px; flex-shrink: 0; color: var(--color-text);
  text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bar-count { width: 40px; flex-shrink: 0; color: var(--color-text-2); font-size: var(--font-size-xs); }
.bar-track {
  flex: 1; min-width: 60px; height: 8px;
  background: var(--color-surface-hover);
  border-radius: 4px; overflow: hidden;
}
.bar-fill { height: 100%; background: var(--color-accent); border-radius: 4px; min-width: 2px; }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: var(--font-size-lg); margin-bottom: 12px; }
  .stats-grid { gap: 8px; grid-template-columns: repeat(2, 1fr); }
  .stat-card { padding: 14px; }
  .stat-value { font-size: 18px; }
  .ops-card { padding: 12px; }
  .trend-day { width: 66px; font-size: var(--font-size-2xs); }
  .trend-num { width: 56px; font-size: var(--font-size-2xs); }
  .bar-label { width: 84px; font-size: var(--font-size-xs); }
}

/* 窄屏：隐藏次要列（备注 / 前缀 / 时间），保留使用者、权限、状态与操作 */
@media (max-width: 640px) {
  .ops-table { min-width: 0; font-size: var(--font-size-xs); }
  .ops-table .col-optional { display: none; }
  .ops-table th, .ops-table td { padding: 8px 6px; }
}
</style>
