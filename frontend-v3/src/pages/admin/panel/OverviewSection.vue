<script lang="ts">
import type { OperationItem } from '@/api/admin'

export interface OverviewData {
  members: number
  admins: number
  students: number
  activeLeaves: number
  pendingLeaves: number
  pendingFeeApprovals: number
  feeBalance: string
  leaveConfigCount: number
  enabledConfigCount: number
  classes: { name: string; count: number }[]
  roleDist: { label: string; count: number }[]
  recentOps: OperationItem[]
}
</script>

<script setup lang="ts">
defineProps<{
  loading: boolean
  data: OverviewData
}>()

const emit = defineEmits<{
  (e: 'switch-tab', tab: 'members' | 'leave-config'): void
  (e: 'navigate', path: string): void
}>()
</script>

<template>
  <section>
    <h2>系统概览</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else>
      <!-- 核心指标 -->
      <div class="overview-section">
        <div class="section-label">核心指标</div>
        <div class="stats-grid">
          <div class="stat-card clickable" @click="emit('switch-tab', 'members')">
            <div class="stat-icon">👥</div>
            <div class="stat-value">{{ data.members }}</div>
            <div class="stat-label">总成员</div>
            <div class="stat-sub">在编学员 {{ data.students }} · 班干部 {{ data.admins }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🏥</div>
            <div class="stat-value">{{ data.activeLeaves }}</div>
            <div class="stat-label">请假中</div>
            <div class="stat-sub">待审批 {{ data.pendingLeaves }} 条</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-value">¥{{ data.feeBalance }}</div>
            <div class="stat-label">班费余额</div>
            <div class="stat-sub">待审批 {{ data.pendingFeeApprovals }} 笔</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📋</div>
            <div class="stat-value">{{ data.enabledConfigCount }}<span class="stat-unit">/{{ data.leaveConfigCount }}</span></div>
            <div class="stat-label">请假类型</div>
            <div class="stat-sub">已启用 / 总数</div>
          </div>
        </div>
      </div>

      <!-- 班级分布 -->
      <div class="overview-section">
        <div class="section-label">班级分布</div>
        <div class="overview-card">
          <div class="bar-list">
            <div v-for="c in data.classes" :key="c.name" class="bar-item">
              <span class="bar-label">{{ c.name }}</span>
              <span class="bar-count">{{ c.count }} 人</span>
              <div class="bar-track"><div class="bar-fill" :style="{ width: (c.count / data.members * 100) + '%' }"></div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 角色分布 + 近期操作 -->
      <div class="overview-row">
        <div class="overview-section flex-1">
          <div class="section-label">角色分布</div>
          <div class="overview-card">
            <div class="bar-list">
              <div v-for="r in data.roleDist" :key="r.label" class="bar-item">
                <span class="bar-label">{{ r.label }}</span>
                <span class="bar-count">{{ r.count }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="overview-section flex-1">
          <div class="section-label">近期操作</div>
          <div class="overview-card">
            <div v-if="data.recentOps.length === 0" class="empty-msg">暂无操作记录</div>
            <div v-for="op in data.recentOps.slice(0, 8)" :key="op.id" class="op-item">
              <span class="op-action">{{ op.action || op.method }}</span>
              <span class="op-path">{{ op.path || op.resource_type }}</span>
              <span class="op-time">{{ (op.created_at || '').slice(0, 16).replace('T', ' ') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="overview-section">
        <div class="section-label">快捷入口</div>
        <div class="quick-links">
          <div class="quick-link" @click="emit('switch-tab', 'members')">👥 成员管理</div>
          <div class="quick-link" @click="emit('switch-tab', 'leave-config')">📋 请假配置</div>
          <div class="quick-link" @click="emit('navigate', '/pages/leave/approvals')">🏥 请假审批</div>
          <div class="quick-link" @click="emit('navigate', '/pages/fee/approvals')">💰 班费审批</div>
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

/* ========== Overview ========== */
.overview-section { margin-bottom: 24px; }
.section-label {
  font-size: 12px; font-weight: 600; color: var(--color-text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.overview-row { display: flex; gap: 16px; }
.overview-row .overview-section { flex: 1; min-width: 0; }
.overview-card {
  background: var(--color-surface);
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.flex-1 { flex: 1; min-width: 0; }

/* ========== Stats ========== */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.stat-card {
  background: var(--color-surface);
  border-radius: 10px;
  padding: 16px;
  box-shadow: var(--shadow-card);
  cursor: default;
}
.stat-card.clickable { cursor: pointer; transition: transform 0.1s; }
.stat-card.clickable:hover { transform: translateY(-1px); }
.stat-icon { font-size: 22px; margin-bottom: 4px; }
.stat-value { font-size: 26px; font-weight: 700; color: var(--color-primary); }
.stat-unit { font-size: 14px; font-weight: 400; color: var(--color-text-3); }
.stat-label { font-size: 12px; color: var(--color-text-2); margin-top: 2px; }
.stat-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }

/* bar chart */
.bar-list { display: flex; flex-direction: column; gap: 8px; }
.bar-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.bar-label { width: 70px; flex-shrink: 0; color: var(--color-text); text-align: right; }
.bar-count { width: 36px; flex-shrink: 0; color: var(--color-text-2); font-size: 12px; }
.bar-track { flex: 1; height: 6px; background: var(--color-surface-2); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--color-accent); border-radius: 3px; min-width: 2px; }

/* ops */
.op-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 0;
  font-size: 12px; border-bottom: 1px solid var(--color-border);
}
.op-item:last-child { border-bottom: none; }
.op-action { color: var(--color-accent); font-weight: 500; min-width: 40px; }
.op-path { flex: 1; color: var(--color-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-time { color: var(--color-text-3); white-space: nowrap; }
.empty-msg { text-align: center; padding: 20px; color: var(--color-text-3); font-size: 13px; }

/* quick links */
.quick-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
.quick-link {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px; font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: background 0.1s;
}
.quick-link:hover { background: var(--color-accent-bg); color: var(--color-accent); }

.loading { padding: 40px; text-align: center; color: var(--color-text-2); font-size: 14px; }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  h2 { font-size: 18px; margin-bottom: 12px; }
  .stats-grid { gap: 8px; grid-template-columns: repeat(2, 1fr); }
  .stat-card { padding: 14px; }
  .stat-value { font-size: 22px; }
  .overview-row { flex-direction: column; gap: 12px; }
  .quick-links { grid-template-columns: repeat(2, 1fr); }
}
</style>
