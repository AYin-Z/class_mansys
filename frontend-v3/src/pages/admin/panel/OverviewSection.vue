<script setup lang="ts">
/**
 * 总览
 *
 * 2026-09 修复：
 *  - 加载失败改为 StateView 错误态 + 「重试」（此前只有 toast，之后整页只剩「暂无数据」）
 *  - 待办入口（getConsoleTodos）失败单独降级提示 + 重试，不影响概览主数据
 *  - emoji 图标 → AppIcon；状态码色值 → 令牌；按钮 → BaseButton；空态 → EmptyState
 */
import { computed, onMounted, ref } from 'vue'
import { getConsoleOverview, getConsoleTodos, type ConsoleOverview } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const loading = ref(true)
/** 概览主数据错误：有值即渲染错误态 + 重试 */
const error = ref<unknown>(null)
const data = ref<ConsoleOverview | null>(null)
const todos = ref<{ key: string; label: string; count: number; path: string }[]>([])
/** 待办入口（次要信息）失败：只提示，不影响概览 */
const todosError = ref(false)

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
  error.value = null
  todosError.value = false
  try {
    const [ov, td] = await Promise.all([getConsoleOverview(), getConsoleTodos().catch(() => null)])
    if (ov?.success) data.value = ov.data
    else {
      data.value = null
      error.value = new Error('未获取到概览数据，请稍后重试')
    }
    if (td?.success) todos.value = td.data.items || []
    else todosError.value = true
  } catch (e) {
    data.value = null
    error.value = e
  } finally {
    loading.value = false
  }
}

async function reloadTodos() {
  todosError.value = false
  try {
    const td = await getConsoleTodos()
    if (td?.success) todos.value = td.data.items || []
    else todosError.value = true
  } catch {
    todosError.value = true
  }
}

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <section class="overview">
    <div class="sec-head">
      <h2>总览</h2>
      <BaseButton variant="secondary" size="sm" :loading="loading" @click="load">刷新</BaseButton>
    </div>

    <StateView :loading="loading" :error="error" loading-text="正在加载概览…" @retry="load">
      <template v-if="data">
        <div class="section-label">中队规模</div>
        <div class="stats-grid">
          <div
            class="stat-card clickable"
            role="button"
            tabindex="0"
            @click="emit('switch-tab', 'classes')"
            @keyup.enter="emit('switch-tab', 'classes')"
          >
            <div class="stat-icon"><AppIcon name="building" :size="18" /></div>
            <div class="stat-value">{{ data.scale.classes }}</div>
            <div class="stat-label">区队</div>
            <div class="stat-sub">{{ data.scale.companies }} 个中队</div>
          </div>
          <div
            class="stat-card clickable"
            role="button"
            tabindex="0"
            @click="emit('switch-tab', 'members')"
            @keyup.enter="emit('switch-tab', 'members')"
          >
            <div class="stat-icon"><AppIcon name="users" :size="18" /></div>
            <div class="stat-value">{{ data.scale.students }}</div>
            <div class="stat-label">在队学员</div>
            <div class="stat-sub">账号共 {{ data.scale.users }} 个</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><AppIcon name="star" :size="18" /></div>
            <div class="stat-value">{{ data.scale.cadres }}</div>
            <div class="stat-label">班干部</div>
            <div class="stat-sub">超管 {{ data.scale.admins }} · 老师 {{ data.scale.staff }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><AppIcon name="logout" :size="18" /></div>
            <div class="stat-value">{{ data.scale.left }}</div>
            <div class="stat-label">已移出统计</div>
            <div class="stat-sub">历史数据保留</div>
          </div>
        </div>

        <div class="section-label">今日情况（{{ data.today.date }}）</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><AppIcon name="calendar" :size="18" /></div>
            <div class="stat-value">{{ data.today.onLeave }}</div>
            <div class="stat-label">当前在假</div>
            <div class="stat-sub">待审批 {{ data.today.pendingLeaves }} 条</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><AppIcon name="check-circle" :size="18" /></div>
            <div class="stat-value">{{ Math.max(0, data.scale.students - data.today.onLeave) }}</div>
            <div class="stat-label">在队</div>
            <div class="stat-sub">应到 {{ data.scale.students }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><AppIcon name="money" :size="18" /></div>
            <div class="stat-value">{{ data.todos.pendingFee }}</div>
            <div class="stat-label">待审批报销</div>
            <div class="stat-sub">建议 {{ data.todos.unhandledSuggestion }} · 心理 {{ data.todos.pendingPsych }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><AppIcon name="alert-circle" :size="18" /></div>
            <div class="stat-value">{{ data.health.errors24h }}</div>
            <div class="stat-label">24h 服务端错误</div>
            <div class="stat-sub">数据库 {{ data.health.dbSizeMb }} MB · {{ data.health.tables }} 表</div>
          </div>
        </div>

        <div class="section-label">待办入口</div>
        <div v-if="todosError" class="inline-warn">
          <AppIcon name="alert-triangle" :size="14" />
          <span>待办入口加载失败（上方统计不受影响）</span>
          <BaseButton variant="text" size="sm" @click="reloadTodos">重试</BaseButton>
        </div>
        <div v-else-if="todos.length === 0" class="inline-hint">暂无待办入口</div>
        <div v-else class="todo-row">
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
              <tr><th>区队</th><th>在队</th><th>干部</th><th class="col-optional">已离开</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in data.classes" :key="c.class_id">
                <td>{{ c.class_name }}</td>
                <td>{{ c.students }}</td>
                <td>{{ c.cadres }}</td>
                <td class="col-optional">{{ c.left || '—' }}</td>
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
        <div v-if="data.recentOps.length === 0" class="inline-hint">近期还没有接口操作记录</div>
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>时间</th><th>用户</th><th class="col-optional">方法</th><th>路径</th><th>状态</th></tr>
            </thead>
            <tbody>
              <tr v-for="o in data.recentOps" :key="o.id">
                <td class="col-time">{{ fmtTime(o.created_at) }}</td>
                <td>{{ o.user_name || '—' }}</td>
                <td class="col-optional">{{ o.method }}</td>
                <td class="mono path-cell">{{ o.path }}</td>
                <td>
                  <BaseBadge :variant="o.status_code >= 500 ? 'danger' : o.status_code >= 400 ? 'warning' : 'success'">
                    {{ o.status_code }}
                  </BaseBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </StateView>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
h2 { font-size: var(--font-size-lg); margin: 0 0 12px; color: var(--color-text); }
.section-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-2); margin: 16px 0 8px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.stat-card {
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md);
  padding: 12px 14px; box-shadow: var(--shadow-card);
}
.stat-card.clickable { cursor: pointer; }
.stat-card.clickable:active { background: var(--color-surface-hover); }
.stat-icon { color: var(--color-text-3); }
.stat-value { font-size: 22px; font-weight: 700; color: var(--color-text); margin-top: 2px; }
.stat-label { font-size: var(--font-size-sm); color: var(--color-text-2); }
.stat-sub { font-size: var(--font-size-2xs); color: var(--color-text-3); margin-top: 2px; }
.todo-row { display: flex; flex-wrap: wrap; gap: 8px; }
.todo-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: var(--font-size-sm); cursor: pointer;
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-full); color: var(--color-text-2);
  font-family: inherit;
}
.todo-chip.hot { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-bg); }
.todo-count { font-weight: 700; }
.inline-warn {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: var(--font-size-xs); color: var(--color-warning);
}
.inline-hint { font-size: var(--font-size-xs); color: var(--color-text-3); }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); background: var(--color-surface); border-radius: var(--radius-md); }
.data-table th, .data-table td { border-bottom: 1px solid var(--color-border); padding: 8px 10px; text-align: left; color: var(--color-text-2); white-space: nowrap; }
.data-table th { color: var(--color-text-3); font-weight: 600; font-size: var(--font-size-xs); }
.mono { font-family: ui-monospace, Menlo, monospace; font-size: var(--font-size-xs); }
.path-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.trend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: var(--font-size-xs); color: var(--color-text-3); }
.trend-day { width: 42px; }
.trend-bar { flex: 1; height: 10px; background: var(--color-surface-hover); border-radius: 5px; overflow: hidden; }
.trend-bar i { display: block; height: 100%; background: var(--color-accent); }
.trend-num { width: 26px; text-align: right; color: var(--color-text-2); }
.role-list { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 6px 12px; }
.role-row { display: flex; justify-content: space-between; font-size: var(--font-size-sm); color: var(--color-text-2); padding: 6px 0; border-bottom: 1px solid var(--color-border); }
.role-row:last-child { border-bottom: none; }
.empty { color: var(--color-text-3); font-size: var(--font-size-sm); }

@media (max-width: 640px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .stat-value { font-size: 19px; }
  .table-wrap { overflow-x: visible; }
  .data-table { font-size: var(--font-size-xs); }
  .data-table .col-optional { display: none; }
  .data-table th, .data-table td { padding: 8px 6px; white-space: normal; }
  .path-cell { max-width: none; overflow: visible; white-space: normal; word-break: break-all; }
  .col-time { white-space: nowrap; }
}
</style>
