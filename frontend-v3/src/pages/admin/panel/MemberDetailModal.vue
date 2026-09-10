<script setup lang="ts">
import type { AdminMember, MemberDetailResult } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import type { UserRoleId } from '@/types/roles'

defineProps<{
  member: AdminMember
  detail: MemberDetailResult | null
  loading: boolean
  roleChanging: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'change-role', memberId: number, newRole: number): void
}>()

function roleLabel(role: number): string {
  return ROLE_LABELS[role as UserRoleId] || String(role)
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <h3>{{ member.name }} 的详情</h3>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="detail" class="detail-body">
        <div class="detail-row">
          <span class="label">学号</span>
          <span>{{ member.student_id }}</span>
        </div>
        <div class="detail-row">
          <span class="label">班级</span>
          <span>{{ member.class_name || member.class_id }}</span>
        </div>
        <div class="detail-row">
          <span class="label">手机</span>
          <span>{{ member.phone || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">邮箱</span>
          <span>{{ member.email || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">当前角色</span>
          <span>{{ roleLabel(member.role) }}</span>
        </div>
        <div class="detail-row role-edit">
          <span class="label">修改角色</span>
          <select
            :value="member.role"
            @change="emit('change-role', member.id, Number(($event.target as HTMLSelectElement).value))"
            :disabled="roleChanging"
          >
            <option v-for="(label, id) in ROLE_LABELS" :key="id" :value="id">{{ label }}</option>
          </select>
        </div>
        <div class="detail-stats">
          <span>请假 {{ detail.stats.leave_count }} 次（通过 {{ detail.stats.approved_leave_count }}）</span>
          <span>积分 {{ detail.stats.total_points }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== Modal ========== */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end; justify-content: center; z-index: 100;
}
.modal-card {
  background: var(--color-surface);
  border-radius: 16px 16px 0 0;
  padding: 20px 16px;
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  overflow-y: auto;
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.modal-header h3 { margin: 0; font-size: 17px; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-2); padding: 4px; }
.detail-body { display: flex; flex-direction: column; gap: 10px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
.detail-row .label { color: var(--color-text-2); }
.role-edit select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
}
.detail-stats { display: flex; gap: 12px; font-size: 12px; color: var(--color-text-2); margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--color-border); flex-wrap: wrap; }

.loading { padding: 40px; text-align: center; color: var(--color-text-2); font-size: 14px; }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  .modal-overlay { align-items: flex-end; }
  .modal-card { border-radius: 16px 16px 0 0; max-width: 100%; }
}
</style>
