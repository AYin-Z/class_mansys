<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getMemberDetail } from '@/api/admin'
import type { LeaveItem, OperationItem } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import { addPointRecord } from '@/api/points'
import { showToast } from '@/utils/ui'
import NavBar from '@/components/ui/NavBar.vue'

const route = useRoute()
const user = ref<any>(null)
const leaves = ref<LeaveItem[]>([])
const activeLeave = ref<any>(null)
const stats = ref({ leave_count: 0, approved_leave_count: 0, pending_leave_count: 0, total_points: 0 })
const loading = ref(true)

// 积分加减
const pointScore = ref(0)
const pointReason = ref('')
const addingPoint = ref(false)
async function handleAddPoint() {
  if (!pointScore.value) { showToast('请输入分值'); return }
  if (!pointReason.value.trim()) { showToast('请输入原因'); return }
  addingPoint.value = true
  try {
    const res = await addPointRecord({
      user_id: Number(route.query.id),
      score: pointScore.value,
      reason: pointReason.value.trim(),
    })
    if (res.success) {
      showToast('积分已更新')
      stats.value.total_points += pointScore.value
      pointScore.value = 0
      pointReason.value = ''
    }
  } catch (e: any) { showToast(e.message || '操作失败', 'error') }
  finally { addingPoint.value = false }
}

onMounted(async () => {
  try {
    const id = Number(route.query.id)
    if (!id) return
    const res = await getMemberDetail(id)
    if (res.success) {
      user.value = res.user
      leaves.value = res.leaves || []
      activeLeave.value = res.active_leave
      stats.value = res.stats || stats.value
    }
  } catch (_) {}
  finally { loading.value = false }
})

function roleLabel(r: number) { return ROLE_LABELS[r] || '学员' }

const leaveStatus = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const leaveStatusClass = (s: number) => ['pending', 'approved', 'rejected'][s] || ''

function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}
function formatDateTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="page">
    <NavBar title="成员详情" show-back />

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="!user" class="state">成员不存在</div>

    <template v-else>
      <!-- 基本信息 -->
      <div class="profile-card">
        <div class="avatar">{{ user.name?.charAt(0) }}</div>
        <div class="info">
          <div class="name">{{ user.name }}</div>
          <div class="meta">
            <span>{{ user.student_id }}</span>
            <span class="role-tag">{{ roleLabel(user.role) }}</span>
            <span v-if="user.duty_note" class="duty-tag">{{ user.duty_note }}</span>
          </div>
          <div class="meta-sub">
            <span v-if="user.class_name">{{ user.class_name }}</span>
            <span v-if="user.phone">{{ user.phone }}</span>
            <span v-if="user.email">{{ user.email }}</span>
          </div>
        </div>
      </div>

      <!-- 统计 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-num">{{ stats.total_points }}</span>
          <span class="stat-label">积分</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ stats.leave_count }}</span>
          <span class="stat-label">请假次数</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ stats.approved_leave_count }}</span>
          <span class="stat-label">已通过</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ stats.pending_leave_count }}</span>
          <span class="stat-label">待审批</span>
        </div>
      </div>

      <!-- 积分操作 -->
      <div class="section">
        <div class="section-title">积分管理（当前 {{ stats.total_points }}）</div>
        <div class="point-row">
          <input v-model.number="pointScore" type="number" class="point-input" placeholder="分值" />
          <input v-model="pointReason" class="point-reason" placeholder="原因" maxlength="30" />
          <button class="point-btn" :disabled="addingPoint" @click="handleAddPoint">
            {{ addingPoint ? '…' : pointScore >= 0 ? '加分' : '扣分' }}
          </button>
        </div>
      </div>

      <!-- 当前生效请假 -->
      <div v-if="activeLeave" class="section">
        <div class="section-title">当前请假</div>
        <div class="active-leave">
          <span>{{ activeLeave.leave_type }}</span>
          <span>{{ activeLeave.start_time?.slice(0,16) }} ~ {{ activeLeave.end_time?.slice(0,16) }}</span>
        </div>
      </div>

      <!-- 请假历史 -->
      <div class="section">
        <div class="section-title">请假记录</div>
        <div v-if="leaves.length === 0" class="empty">暂无</div>
        <div v-for="l in leaves" :key="l.id" class="leave-item">
          <span>{{ l.leave_type }}</span>
          <span>{{ l.start_time?.slice(0,10) }}</span>
          <span :class="leaveStatusClass(l.status)">{{ leaveStatus(l.status) }}</span>
        </div>
      </div>

      <!-- 最近活跃 -->
      <div class="section">
        <div class="section-title">注册时间</div>
        <div class="text">{{ formatDateTime(user.created_at) }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

.profile-card {
  display: flex; gap: 14px; padding: 20px 16px; margin: 12px;
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}
.avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--color-accent-bg); color: var(--color-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; flex-shrink: 0;
}
.info { flex: 1; }
.name { font-size: 18px; font-weight: 700; color: var(--color-text); }
.meta { font-size: 13px; color: var(--color-text-2); margin-top: 2px; display: flex; gap: 8px; align-items: center; }
.meta-sub { font-size: 12px; color: var(--color-text-3); margin-top: 2px; display: flex; gap: 8px; }
.role-tag { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--color-accent-bg); color: var(--color-accent); }
.duty-tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--color-surface-hover); color: var(--color-text-3); }

.stats-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  padding: 0 12px; margin-bottom: 16px;
}
.stat-item {
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); padding: 12px 8px; text-align: center;
}
.stat-num { font-size: 20px; font-weight: 700; color: var(--color-accent); display: block; }
.stat-label { font-size: 11px; color: var(--color-text-3); margin-top: 2px; display: block; }

.section { padding: 0 16px; margin-bottom: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.empty, .text { font-size: 13px; color: var(--color-text-3); }

.active-leave {
  display: flex; gap: 12px; padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--color-warning-bg); color: var(--color-warning);
  font-size: 13px; font-weight: 500;
}

.leave-item {
  display: flex; gap: 12px; padding: 8px 0; font-size: 13px; color: var(--color-text-2);
  border-bottom: 1px solid var(--color-border);
}
.leave-item:last-child { border-bottom: none; }
.leave-item span:first-child { flex: 1; font-weight: 500; }
.leave-item span:last-child { font-size: 11px; font-weight: 600; }
.leave-item .pending { color: var(--color-warning); }
.leave-item .approved { color: #16a34a; }
.leave-item .rejected { color: var(--color-error); }

.point-row { display: flex; gap: 6px; }
.point-input { width: 72px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; background: var(--color-surface); color: var(--color-text); outline: none; }
.point-reason { flex: 1; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; background: var(--color-surface); color: var(--color-text); outline: none; }
.point-btn { padding: 8px 14px; border: none; border-radius: var(--radius-sm); background: var(--color-accent); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.point-btn:disabled { opacity: 0.5; }
</style>
