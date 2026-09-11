<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getConsoleTodos, getConsoleOverview, type ConsoleOverview } from '@/api/admin'
import { showToast } from '@/utils/ui'

const loading = ref(true)
const items = ref<{ key: string; label: string; count: number; path: string }[]>([])
const overview = ref<ConsoleOverview | null>(null)

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

async function load() {
  loading.value = true
  try {
    const [t, o] = await Promise.all([getConsoleTodos(), getConsoleOverview().catch(() => null)])
    if (t?.success) items.value = t.data.items || []
    if (o?.success) overview.value = o.data
  } catch (e: any) {
    showToast(e?.message || '加载待办失败', 'error')
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
      <button class="btn-sm" @click="load">刷新</button>
    </div>
    <p class="tips">这里是全中队的待处理事项汇总，点击可直接跳到对应模块处理。</p>

    <div v-if="loading" class="loading">加载中…</div>
    <template v-else>
      <div class="todo-grid">
        <div v-for="t in items" :key="t.key" class="todo-card" :class="{ hot: t.count > 0 }" @click="emit('navigate', t.path)">
          <div class="todo-count">{{ t.count }}</div>
          <div class="todo-label">{{ t.label }}</div>
          <div class="todo-desc">{{ DESC[t.key] || '' }}</div>
        </div>
      </div>

      <template v-if="overview">
        <div class="section-label">今日请假类型分布</div>
        <div class="chip-row">
          <span v-for="x in overview.today.byType" :key="x.type" class="chip">{{ x.type }} · {{ x.count }}</span>
          <span v-if="!overview.today.byType.length" class="empty">今日暂无请假</span>
        </div>

        <div class="section-label">快速入口</div>
        <div class="chip-row">
          <button class="chip-btn" @click="emit('navigate', '/pages/leave/approvals')">请假审批</button>
          <button class="chip-btn" @click="emit('navigate', '/pages/fee/approvals')">班费审批</button>
          <button class="chip-btn" @click="emit('navigate', '/pages/suggestion/inbox')">建议处理</button>
          <button class="chip-btn" @click="emit('navigate', '/pages/company/index')">中队出勤</button>
          <button class="chip-btn" @click="emit('navigate', '/pages/notice/admin')">发布通知</button>
          <button class="chip-btn" @click="emit('navigate', '/pages/announcement/admin')">发布公告</button>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; }
h2 { font-size: 18px; margin: 0 0 8px; color: var(--color-text); }
.tips { font-size: 12px; color: var(--color-text-3); margin: 0 0 12px; }
.todo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.todo-card {
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md, 12px);
  padding: 14px; cursor: pointer; box-shadow: var(--shadow-card);
}
.todo-card.hot { border-color: var(--color-accent); }
.todo-card:active { background: var(--color-surface-hover); }
.todo-count { font-size: 26px; font-weight: 700; color: var(--color-text); }
.todo-card.hot .todo-count { color: var(--color-accent); }
.todo-label { font-size: 14px; color: var(--color-text); margin-top: 2px; }
.todo-desc { font-size: 11px; color: var(--color-text-3); margin-top: 4px; line-height: 1.5; }
.section-label { font-size: 13px; font-weight: 600; color: var(--color-text-2); margin: 18px 0 8px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-size: 12px; padding: 5px 10px; border-radius: 999px; background: var(--color-surface-hover); color: var(--color-text-2); }
.chip-btn {
  font-size: 13px; padding: 7px 12px; border-radius: 8px; cursor: pointer;
  background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-2);
}
.loading, .empty { color: var(--color-text-3); font-size: 13px; }
.btn-sm { font-size: 12px; padding: 5px 10px; border-radius: 8px; cursor: pointer; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-2); }
</style>
