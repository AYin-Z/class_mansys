<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getConsoleOverview, getConsoleTodos, type ConsoleOverview } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import { showToast } from '@/utils/ui'

const loading = ref(true)
const data = ref<ConsoleOverview | null>(null)
const todos = ref<{ key: string; label: string; count: number; path: string }[]>([])

const emit = defineEmits<{
  (e: 'switch-tab', tab: string): void
  (e: 'navigate', path: string): void
}>()

const maxTrend = computed(() => Math.max(1, ...(data.value?.trend || []).map((t) => t.count)))

function fmtTime(v: string | Date | undefined): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
}

async function load() {
  loading.value = true
  try {
    const [ov, td] = await Promise.all([getConsoleOverview(), getConsoleTodos().catch(() => null)])
    if (ov?.success) data.value = ov.data
    if (td?.success) todos.value = td.data.items || []
  } catch (e: any) {
    showToast(e?.message || '加载概览失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <section class="overview">
    <div class="sec-head">
      <h2>总览</h2>
      <button class="btn-sm" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="loading">加载中…</div>
    <template v-else-if="data">
      <div class="section-label">中队规模</div>
      <div class="stats-grid">
        <div class="stat-card clickable" @click="emit('switch-tab', 'classes')">
          <div class="stat-icon">🏢</div>
          <div class="stat-value">{{ data.scale.classes }}</div>
          <div class="stat-label">区队</div>
          <div class="stat-sub">{{ data.scale.companies }} 个中队</div>
        </div>
        <div class="stat-card clickable" @click="emit('switch-tab', 'members')">
          <div class="stat-icon">👥</div>
          <div class="stat-value">{{ data.scale.students }}</div>
          <div class="stat-label">在队学员</div>
          <div class="stat-sub">账号共 {{ data.scale.users }} 个</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🎖️</div>
          <div class="stat-value">{{ data.scale.cadres }}</div>
          <div class="stat-label">班干部</div>
          <div class="stat-sub">超管 {{ data.scale.admins }} · 老师 {{ data.scale.staff }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🚪</div>
          <div class="stat-value">{{ data.scale.left }}</div>
          <div class="stat-label">已移出统计</div>
          <div class="stat-sub">历史数据保留</div>
        </div>
      </div>

      <div class="section-label">今日情况（{{ data.today.date }}）</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🏥</div>
          <div class="stat-value">{{ data.today.onLeave }}</div>
          <div class="stat-label">当前在假</div>
          <div class="stat-sub">待审批 {{ data.today.pendingLeaves }} 条</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-value">{{ Math.max(0, data.scale.students - data.today.onLeave) }}</div>
          <div class="stat-label">在队</div>
          <div class="stat-sub">应到 {{ data.scale.students }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-value">{{ data.todos.pendingFee }}</div>
          <div class="stat-label">待审批报销</div>
          <div class="stat-sub">建议 {{ data.todos.unhandledSuggestion }} · 心理 {{ data.todos.pendingPsych }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🩺</div>
          <div class="stat-value">{{ data.health.errors24h }}</div>
          <div class="stat-label">24h 服务端错误</div>
          <div class="stat-sub">数据库 {{ data.health.dbSizeMb }} MB · {{ data.health.tables }} 表</div>
        </div>
      </div>

      <div class="section-label">待办入口</div>
      <div class="todo-row">
        <button
          v-for="t in todos"
          :key="t.key"
          class="todo-chip"
          :class="{ hot: t.count > 0 }"
          @click="emit('navigate', t.path)"
        >
          {{ t.label }}
          <span class="todo-count">{{ t.count }}</span>
        </button>
      </div>

      <div class="section-label">区队分布</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>区队</th><th>在队</th><th>干部</th><th>已离开</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in data.classes" :key="c.class_id">
              <td>{{ c.class_name }}</td>
              <td>{{ c.students }}</td>
              <td>{{ c.cadres }}</td>
              <td>{{ c.left || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="two-col">
        <div>
          <div class="section-label">近 7 日请假申请</div>
          <div class="trend">
            <div v-for="t in data.trend" :key="t.day" class="trend-row">
              <span class="trend-day">{{ String(t.day).slice(5) }}</span>
              <span class="trend-bar"><i :style="{ width: (t.count / maxTrend) * 100 + '%' }"></i></span>
              <span class="trend-num">{{ t.count }}</span>
            </div>
            <div v-if="!data.trend.length" class="empty">近 7 日无请假申请</div>
          </div>
        </div>
        <div>
          <div class="section-label">职务分布</div>
          <div class="role-list">
            <div v-for="r in data.roleDist" :key="r.role" class="role-row">
              <span>{{ ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] || ('角色' + r.role) }}</span>
              <b>{{ r.count }}</b>
            </div>
          </div>
        </div>
      </div>

      <div class="section-label">办事助手 / 渠道</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">{{ data.agent.messages7d }}</div><div class="stat-label">近 7 日消息</div></div>
        <div class="stat-card"><div class="stat-value">{{ data.agent.users }}</div><div class="stat-label">使用过助手的用户</div></div>
        <div class="stat-card"><div class="stat-value">{{ data.agent.activeTokens }}</div><div class="stat-label">MCP 令牌（有效）</div></div>
        <div class="stat-card"><div class="stat-value">{{ data.agent.wechatBindings }}</div><div class="stat-label">微信绑定</div></div>
      </div>

      <div class="section-label">最近操作</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>时间</th><th>用户</th><th>方法</th><th>路径</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="o in data.recentOps" :key="o.id">
              <td>{{ fmtTime(o.created_at) }}</td>
              <td>{{ o.user_name || '—' }}</td>
              <td>{{ o.method }}</td>
              <td class="mono">{{ o.path }}</td>
              <td>
                <span class="code-tag" :class="o.status_code >= 500 ? 'bad' : o.status_code >= 400 ? 'warn' : 'ok'">{{ o.status_code }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <div v-else class="empty">暂无数据</div>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; }
h2 { font-size: 18px; margin: 0 0 12px; color: var(--color-text); }
.section-label { font-size: 13px; font-weight: 600; color: var(--color-text-2); margin: 16px 0 8px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.stat-card {
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md, 12px);
  padding: 12px 14px; box-shadow: var(--shadow-card);
}
.stat-card.clickable { cursor: pointer; }
.stat-card.clickable:active { background: var(--color-surface-hover); }
.stat-icon { font-size: 16px; }
.stat-value { font-size: 22px; font-weight: 700; color: var(--color-text); margin-top: 2px; }
.stat-label { font-size: 13px; color: var(--color-text-2); }
.stat-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }
.todo-row { display: flex; flex-wrap: wrap; gap: 8px; }
.todo-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 13px; cursor: pointer;
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 999px; color: var(--color-text-2);
}
.todo-chip.hot { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-bg); }
.todo-count { font-weight: 700; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--color-surface); border-radius: var(--radius-md, 12px); }
.data-table th, .data-table td { border-bottom: 1px solid var(--color-border); padding: 8px 10px; text-align: left; color: var(--color-text-2); white-space: nowrap; }
.data-table th { color: var(--color-text-3); font-weight: 600; font-size: 12px; }
.mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
.code-tag { padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.code-tag.ok { background: rgba(46, 160, 67, 0.12); color: #2ea043; }
.code-tag.warn { background: rgba(255, 170, 0, 0.15); color: var(--color-warning); }
.code-tag.bad { background: rgba(229, 72, 77, 0.12); color: #e5484d; }
.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.trend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px; color: var(--color-text-3); }
.trend-day { width: 42px; }
.trend-bar { flex: 1; height: 10px; background: var(--color-surface-hover); border-radius: 5px; overflow: hidden; }
.trend-bar i { display: block; height: 100%; background: var(--color-accent); }
.trend-num { width: 26px; text-align: right; color: var(--color-text-2); }
.role-list { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md, 12px); padding: 6px 12px; }
.role-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--color-text-2); padding: 6px 0; border-bottom: 1px solid var(--color-border); }
.role-row:last-child { border-bottom: none; }
.loading, .empty { color: var(--color-text-3); font-size: 13px; padding: 12px 0; }
.btn-sm {
  font-size: 12px; padding: 5px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-2);
}
</style>
