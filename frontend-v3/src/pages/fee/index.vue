<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMyExpenses, getSummary, getCollections, getPublications } from '@/api/fee'
import { useUserStore } from '@/stores/user'
import type { FeeExpense, FeeCollection, FeePublication } from '@/api/fee'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const userStore = useUserStore()
const isAdmin = userStore.isAdmin

const expenses = ref<FeeExpense[]>([])
const collections = ref<FeeCollection[]>([])
const publications = ref<FeePublication[]>([])
const balance = ref(0)
const totalIncome = ref(0)
const totalExpense = ref(0)
const pendingCount = ref(0)
const loading = ref(true)
const tab = ref<'expense' | 'collection' | 'publication'>(isAdmin ? 'collection' : 'expense')

onMounted(async () => {
  try {
    const [expRes, sumRes, colRes, pubRes] = await Promise.all([
      getMyExpenses().catch(() => null),
      getSummary().catch(() => null),
      getCollections().catch(() => null),
      getPublications().catch(() => null),
    ])
    if (expRes?.success) expenses.value = expRes.expenses || []
    if (sumRes?.success) {
      const s = sumRes.data?.summary || sumRes.summary || sumRes || {}
      balance.value = Number(s.balance || 0)
      totalIncome.value = Number(s.totalIncome || 0)
      totalExpense.value = Number(s.totalExpense || 0)
      pendingCount.value = (s.pending_small || 0) + (s.pending_medium || 0) + (s.pending_large || 0)
    }
    if (colRes?.success) collections.value = colRes.collections || colRes.data?.collections || []
    if (pubRes?.success) publications.value = pubRes.publications || pubRes.data?.publications || []
  } catch (_) {}
  finally { loading.value = false }
})

const statusLabel = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const statusClass = (s: number) => ['pending', 'approved', 'rejected'][s] || ''

function goApply() { router.push('/pages/fee/expense-apply') }
function goDetail(id: number) { router.push({ path: '/pages/fee/expense-detail', query: { id: String(id) } }) }
function goApprovals() { router.push('/pages/fee/approvals') }
</script>

<template>
  <div class="fee-page">
    <NavBar title="班费管理" />

    <!-- 余额卡片 -->
    <div class="balance-card">
      <div class="balance-label">当前余额</div>
      <div class="balance-amount">¥{{ balance.toFixed(2) }}</div>
      <div class="balance-sub">
        <span>收 {{ totalIncome.toFixed(2) }}</span>
        <span>支 {{ totalExpense.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="quick-actions">
      <div class="quick-item" @click="goApply">
        <span class="qi-icon">🧾</span><span class="qi-label">申请报销</span>
      </div>
      <div class="quick-item" @click="goApprovals">
        <span class="qi-icon">📋</span>
        <span class="qi-label">审批
          <span v-if="isAdmin && pendingCount > 0" class="badge">{{ pendingCount }}</span>
        </span>
      </div>
      <div class="quick-item" @click="goApply">
        <span class="qi-icon">📎</span><span class="qi-label">上传凭证</span>
      </div>
    </div>

    <!-- Tab -->
    <div class="tab-bar">
      <span :class="['tab', { active: tab === 'collection' }]" @click="tab = 'collection'">收缴记录</span>
      <span :class="['tab', { active: tab === 'expense' }]" @click="tab = 'expense'">报销记录</span>
      <span :class="['tab', { active: tab === 'publication' }]" @click="tab = 'publication'">公示</span>
    </div>

    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- 收缴 -->
    <template v-if="tab === 'collection'">
      <div v-if="collections.length === 0" class="empty-state">暂无收缴记录</div>
      <div v-for="c in collections" :key="c.id" class="card">
        <div class="card-row">
          <span class="card-title">{{ c.title }}</span>
          <span class="status-tag approved">{{ c.status === 1 ? '已截止' : '收集中' }}</span>
        </div>
        <div class="card-row">
          <span>人均 ¥{{ Number(c.amount_per_person).toFixed(2) }}</span>
          <span>已收 ¥{{ Number(c.collected_amount).toFixed(2) }}</span>
          <span>预期 ¥{{ Number(c.total_expected).toFixed(2) }}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" :style="{ width: (c.total_expected > 0 ? Math.min(100, Number(c.collected_amount) / Number(c.total_expected) * 100) : 0) + '%' }"></div></div>
      </div>
    </template>

    <!-- 报销 -->
    <template v-if="tab === 'expense'">
      <div v-if="expenses.length === 0" class="empty-state">暂无报销记录</div>
      <div v-for="e in expenses" :key="e.id" class="card" @click="goDetail(e.id)">
        <div class="card-row">
          <span class="card-title">{{ e.purpose }}</span>
          <span :class="['status-tag', statusClass(e.status)]">{{ statusLabel(e.status) }}</span>
        </div>
        <div class="card-row sub">
          <span>¥{{ Number(e.amount).toFixed(2) }}</span>
          <span>{{ e.created_at?.slice(0, 10) }}</span>
          <span v-if="e.tier">{{ e.tier === 'small' ? '小额' : e.tier === 'medium' ? '中额' : '大额' }}</span>
        </div>
      </div>
    </template>

    <!-- 公示 -->
    <template v-if="tab === 'publication'">
      <div v-if="publications.length === 0" class="empty-state">暂无公示</div>
      <div v-for="p in publications" :key="p.id" class="card">
        <div class="card-row">
          <span class="card-title">{{ p.title }}</span>
          <span class="card-muted">{{ p.period }}</span>
        </div>
        <div class="card-row sub">
          <span>收 ¥{{ Number(p.total_income).toFixed(2) }}</span>
          <span>支 ¥{{ Number(p.total_expense).toFixed(2) }}</span>
          <span>余 ¥{{ Number(p.balance).toFixed(2) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fee-page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.loading-state, .empty-state { text-align: center; padding: 40px 16px; font-size: 14px; color: var(--color-text-3); }

.balance-card {
  margin: 16px 12px; padding: 20px; border-radius: var(--radius-md);
  background: linear-gradient(135deg, #1a3a5c, #2d6a9f); color: #fff;
  text-align: center; box-shadow: 0 4px 15px rgba(26,58,92,0.2);
}
.balance-label { font-size: 13px; opacity: 0.8; }
.balance-amount { font-size: 36px; font-weight: 700; margin: 4px 0; }
.balance-sub { font-size: 12px; opacity: 0.7; display: flex; gap: 16px; justify-content: center; }

.quick-actions { display: flex; gap: 10px; padding: 0 12px; margin-bottom: 16px; }
.quick-item {
  flex: 1; padding: 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
  text-align: center; cursor: pointer;
}
.qi-icon { display: block; font-size: 20px; margin-bottom: 4px; }
.qi-label { font-size: 13px; font-weight: 500; color: var(--color-text-2); }
.badge { display: inline-block; background: var(--color-error); color: #fff; font-size: 11px; padding: 1px 6px; border-radius: 8px; margin-left: 4px; }

.tab-bar { display: flex; gap: 4px; padding: 0 16px; margin-bottom: 12px; }
.tab { padding: 6px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text-2); cursor: pointer; }
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }

.card {
  margin: 0 12px 8px; padding: 14px 16px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card); cursor: pointer;
}
.card-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.card-row.sub { font-size: 12px; color: var(--color-text-3); margin-top: 6px; }
.card-row.sub span { min-width: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.card-muted { font-size: 12px; color: var(--color-text-3); }
.status-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.status-tag.pending { background: var(--color-warning-bg); color: var(--color-warning); }
.status-tag.approved { background: #dcfce7; color: #16a34a; }
.status-tag.rejected { background: var(--color-error-bg); color: var(--color-error); }

.progress-bar { height: 4px; background: var(--color-border); border-radius: 2px; margin-top: 8px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
</style>
