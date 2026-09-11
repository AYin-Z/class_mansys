<script setup lang="ts">
/**
 * 内容与待办
 *
 * 2026-09 修复：
 *  - 加载失败不再只弹 toast（页面随后是空的待办网格），error 交给 StateView + 重试
 *  - 概览（今日分布）失败单独降级提示，不影响待办主列表，可单独重试
 *  - 空态 → EmptyState（说明为什么空 + 下一步）；按钮 → BaseButton
 */
import { onMounted, ref } from 'vue'
import { getConsoleTodos, getConsoleOverview, type ConsoleOverview } from '@/api/admin'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const loading = ref(true)
/** 待办主列表错误（有值即错误态 + 重试） */
const error = ref<unknown>(null)
const items = ref<{ key: string; label: string; count: number; path: string }[]>([])
const overview = ref<ConsoleOverview | null>(null)
/** 概览（次要信息）加载失败：仅提示，不影响待办列表 */
const overviewError = ref(false)

const emit = defineEmits<{ (e: 'navigate', path: string): void }>()

const DESC: Record<string, string> = {
  leave: '学员提交的请假申请，需要干部审核通过或驳回',
  leave_ongoing: '当前正处于请假时段内的人员（中队视角可看明细）',
  fee: '班费报销申请，需要按审批链处理',
  homework: '学员已提交、等待干部批改的作业',
  suggestion: '建议箱中尚未处理/回复的建议',
  psych: '心理咨询申请，仅对应处理人可见',
  photo: '相册中待审核的照片'
}

async function loadOverview() {
  overviewError.value = false
  try {
    const o = await getConsoleOverview()
    if (o?.success) overview.value = o.data
    else overviewError.value = true
  } catch {
    overview.value = null
    overviewError.value = true
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [t, o] = await Promise.all([
      getConsoleTodos(),
      getConsoleOverview().catch(() => null)
    ])
    if (t?.success) items.value = t.data.items || []
    else error.value = new Error('待办数据加载失败，请稍后重试')
    if (o?.success) overview.value = o.data
    else overviewError.value = true
  } catch (e) {
    items.value = []
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <section>
    <div class="sec-head">
      <h2>内容与待办</h2>
      <BaseButton variant="secondary" size="sm" :loading="loading" @click="load">刷新</BaseButton>
    </div>
    <p class="tips">这里是全中队的待处理事项汇总，点击可直接跳到对应模块处理。</p>

    <StateView
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      loading-text="正在加载待办事项…"
      @retry="load"
    >
      <template #empty>
        <EmptyState
          icon="check-circle"
          title="当前没有待处理事项"
          description="请假审批、班费报销、建议处理等都处理完了；有新申请时这里会自动出现卡片。"
          action-text="重新加载"
          @action="load"
        />
      </template>

      <div class="todo-grid">
        <div v-for="t in items" :key="t.key" class="todo-card" :class="{ hot: t.count > 0 }" @click="emit('navigate', t.path)">
          <div class="todo-count">{{ t.count }}</div>
          <div class="todo-label">{{ t.label }}</div>
          <div class="todo-desc">{{ DESC[t.key] || '' }}</div>
        </div>
      </div>
    </StateView>

    <!-- 快速入口与辅助信息：加载失败时不显示（错误态已有重试入口），无待办时仍可跳转 -->
    <template v-if="!loading && !error">
      <div v-if="overviewError" class="inline-warn">
        <AppIcon name="alert-triangle" :size="14" />
        <span>今日请假分布加载失败（待办数量不受影响）</span>
        <BaseButton variant="text" size="sm" @click="loadOverview">重试</BaseButton>
      </div>

      <template v-if="overview">
        <div class="section-label">今日请假类型分布</div>
        <div class="chip-row">
          <span v-for="x in overview.today.byType" :key="x.type" class="chip">{{ x.type }} · {{ x.count }}</span>
          <span v-if="!overview.today.byType.length" class="empty">今日暂无请假</span>
        </div>
      </template>

      <div class="section-label">快速入口</div>
      <div class="chip-row">
        <BaseButton variant="secondary" size="sm" @click="emit('navigate', '/pages/leave/approvals')">请假审批</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="emit('navigate', '/pages/fee/approvals')">班费审批</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="emit('navigate', '/pages/suggestion/inbox')">建议处理</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="emit('navigate', '/pages/company/index')">中队出勤</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="emit('navigate', '/pages/notice/admin')">发布通知</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="emit('navigate', '/pages/announcement/admin')">发布公告</BaseButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
h2 { font-size: var(--font-size-lg); margin: 0 0 8px; color: var(--color-text); }
.tips { font-size: var(--font-size-xs); color: var(--color-text-3); margin: 0 0 12px; }
.todo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.todo-card {
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md);
  padding: 14px; cursor: pointer; box-shadow: var(--shadow-card);
}
.todo-card.hot { border-color: var(--color-accent); }
.todo-card:active { background: var(--color-surface-hover); }
.todo-count { font-size: 26px; font-weight: 700; color: var(--color-text); }
.todo-card.hot .todo-count { color: var(--color-accent); }
.todo-label { font-size: var(--font-size-body); color: var(--color-text); margin-top: 2px; }
.todo-desc { font-size: var(--font-size-2xs); color: var(--color-text-3); margin-top: 4px; line-height: 1.5; }
.section-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-2); margin: 18px 0 8px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-size: var(--font-size-xs); padding: 5px 10px; border-radius: var(--radius-full); background: var(--color-surface-hover); color: var(--color-text-2); }
.empty { color: var(--color-text-3); font-size: var(--font-size-sm); }
.inline-warn {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-top: 12px; font-size: var(--font-size-xs); color: var(--color-warning);
}

@media (max-width: 640px) {
  .todo-grid { grid-template-columns: 1fr; }
  .chip-row :deep(.btn) { width: 100%; }
  .chip-row { display: grid; grid-template-columns: 1fr 1fr; }
}
</style>
