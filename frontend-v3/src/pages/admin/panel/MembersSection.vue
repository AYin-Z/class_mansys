<script setup lang="ts">
import type { AdminMember } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import type { UserRoleId } from '@/types/roles'

defineProps<{
  members: AdminMember[]
  loading: boolean
  search: string
}>()

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'search'): void
  (e: 'open-detail', member: AdminMember): void
}>()

function roleLabel(role: number): string {
  return ROLE_LABELS[role as UserRoleId] || String(role)
}
</script>

<template>
  <section>
    <h2>成员管理</h2>
    <div class="toolbar">
      <input
        :value="search"
        placeholder="搜索姓名/学号/手机号"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        @keyup.enter="emit('search')"
      />
      <button class="btn-sm" @click="emit('search')">搜索</button>
    </div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>姓名</th>
          <th>学号</th>
          <th>角色</th>
          <th>班级</th>
          <th>请假中</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in members" :key="m.id" @click="emit('open-detail', m)" class="clickable">
          <td>{{ m.name }}</td>
          <td>{{ m.student_id }}</td>
          <td>{{ roleLabel(m.role) }}</td>
          <td>{{ m.class_name || m.class_id }}</td>
          <td>{{ m.active_leave_count ? m.active_leave_count + ' 条' : '—' }}</td>
        </tr>
      </tbody>
    </table>
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

/* ========== Toolbar ========== */
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.toolbar input {
  flex: 1;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
}

/* ========== Table ========== */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: 8px; overflow: hidden; min-width: 500px; }
.data-table th, .data-table td {
  text-align: left;
  padding: 8px 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);
}
.data-table th { background: var(--color-surface-2); font-weight: 600; color: var(--color-text); white-space: nowrap; }
.data-table td { color: var(--color-text); }
.clickable { cursor: pointer; }
.clickable:hover { background: var(--color-surface-2); }

.btn-sm {
  padding: 8px 16px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.loading { padding: 40px; text-align: center; color: var(--color-text-2); font-size: 14px; }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: 18px; margin-bottom: 12px; }
}
</style>
