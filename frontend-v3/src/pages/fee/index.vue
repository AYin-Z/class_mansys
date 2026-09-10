<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMyExpenses, getSummary, getCollections, getPublications, createCollection, payCollection, closeCollection, exemptCollection, getCollectionRecords } from '@/api/fee'
import { useUserStore } from '@/stores/user'
import type { FeeExpense, FeeCollection, FeePublication, FeeCollectionRecord } from '@/api/fee'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const userStore = useUserStore()
const isAdmin = userStore.isAdmin
const role = userStore.role
const canManageCollection = role === 2 || role === 8 // 生活副区或超管

const expenses = ref<FeeExpense[]>([])
const collections = ref<FeeCollection[]>([])
const publications = ref<FeePublication[]>([])
const balance = ref(0)
const totalIncome = ref(0)
const totalExpense = ref(0)
const pendingCount = ref(0)
const loading = ref(true)
const tab = ref<'expense' | 'collection' | 'publication'>(isAdmin ? 'collection' : 'expense')

// 收缴弹窗
const showCreateModal = ref(false)
const newCollection = ref({ title: '', amount: 0, semester: '' })
const creating = ref(false)

// 缴纳弹窗
const showPayModal = ref(false)
const payTarget = ref<FeeCollection | null>(null)
const payAmount = ref(0)
const paying = ref(false)

// 免缴弹窗
const showExemptModal = ref(false)
const exemptTarget = ref<FeeCollection | null>(null)
const exemptUserId = ref(0)
const exemptRemark = ref('')

// 明细弹窗
const showRecordsModal = ref(false)
const recordsTarget = ref<FeeCollection | null>(null)
const records = ref<FeeCollectionRecord[]>([])
const recordsLoading = ref(false)

onMounted(() => { loadData() })

async function loadData() {
  loading.value = true
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
}

const statusLabel = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const statusClass = (s: number) => ['pending', 'approved', 'rejected'][s] || ''

function goApply() { router.push('/pages/fee/expense-apply') }
function goDetail(id: number) { router.push({ path: '/pages/fee/expense-detail', query: { id: String(id) } }) }
function goApprovals() { router.push('/pages/fee/approvals') }
function goPublicationDetail(id: number) {
  router.push({ path: '/pages/fee/publication-detail', query: { id: String(id) } })
}

// 发起收缴
async function doCreateCollection() {
  if (!newCollection.value.title || !newCollection.value.amount || !newCollection.value.semester) return
  creating.value = true
  try {
    await createCollection({ title: newCollection.value.title, amount_per_person: newCollection.value.amount, semester: newCollection.value.semester })
    showCreateModal.value = false
    newCollection.value = { title: '', amount: 0, semester: '' }
    await loadData()
  } catch (e: any) { alert(e?.message || '创建失败') }
  finally { creating.value = false }
}

// 缴纳
function openPay(c: FeeCollection) { payTarget.value = c; payAmount.value = Number(c.amount_per_person); showPayModal.value = true }
async function doPay() {
  if (!payTarget.value || payAmount.value <= 0) return
  paying.value = true
  try {
    await payCollection(payTarget.value.id, payAmount.value)
    showPayModal.value = false
    await loadData()
  } catch (e: any) { alert(e?.message || '缴纳失败') }
  finally { paying.value = false }
}

// 免缴
function openExempt(c: FeeCollection) { exemptTarget.value = c; exemptUserId.value = 0; exemptRemark.value = ''; showExemptModal.value = true }
async function doExempt() {
  if (!exemptTarget.value || !exemptUserId.value) return
  try {
    await exemptCollection(exemptTarget.value.id, exemptUserId.value, exemptRemark.value)
    showExemptModal.value = false
    await loadData()
  } catch (e: any) { alert(e?.message || '操作失败') }
}

// 截止
async function doClose(c: FeeCollection) {
  if (!confirm('确定截止该收缴批次吗？')) return
  try { await closeCollection(c.id); await loadData() } catch (e: any) { alert(e?.message || '操作失败') }
}

// 查看明细
async function openRecords(c: FeeCollection) {
  recordsTarget.value = c; recordsLoading.value = true; showRecordsModal.value = true
  try { const res: any = await getCollectionRecords(c.id); records.value = res.records || res.data?.records || [] }
  catch { records.value = [] }
  finally { recordsLoading.value = false }
}
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
      <div v-if="canManageCollection" class="section-actions">
        <button class="btn-accent" @click="showCreateModal = true">+ 发起收缴</button>
      </div>
      <div v-if="collections.length === 0" class="empty-state">暂无收缴记录</div>
      <div v-for="c in collections" :key="c.id" class="card">
        <div class="card-row">
          <span class="card-title">{{ c.title }}</span>
          <span :class="['status-tag', c.status === 1 ? 'approved' : c.status === 2 ? 'rejected' : 'pending']">
            {{ c.status === 2 ? '已结清' : c.status === 1 ? '已截止' : '收集中' }}
          </span>
        </div>
        <div class="card-row sub">
          <span>人均 ¥{{ Number(c.amount_per_person).toFixed(2) }}</span>
          <span>已收 ¥{{ Number(c.collected_amount).toFixed(2) }}</span>
          <span>预期 ¥{{ Number(c.total_expected).toFixed(2) }}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" :style="{ width: (c.total_expected > 0 ? Math.min(100, Number(c.collected_amount) / Number(c.total_expected) * 100) : 0) + '%' }"></div></div>
        <div class="card-actions">
          <button v-if="c.status === 0" class="btn-xs" @click="openPay(c)">💵 缴纳</button>
          <button v-if="canManageCollection && c.status === 0" class="btn-xs" @click="openExempt(c)">✏️ 免缴</button>
          <button v-if="canManageCollection && c.status === 0" class="btn-xs" @click="doClose(c)">🔒 截止</button>
          <button v-if="isAdmin" class="btn-xs" @click="openRecords(c)">📋 明细</button>
        </div>
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
      <div v-for="p in publications" :key="p.id" class="card" @click="goPublicationDetail(p.id)">
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

    <!-- 发起收缴弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-card">
        <div class="modal-header"><h3>发起收缴</h3><button class="btn-close" @click="showCreateModal = false">✕</button></div>
        <div class="form-group"><label>标题</label><input v-model="newCollection.title" placeholder="如：2026春季班费" /></div>
        <div class="form-group"><label>人均金额</label><input v-model.number="newCollection.amount" type="number" placeholder="0.00" /></div>
        <div class="form-group"><label>学期</label><input v-model="newCollection.semester" placeholder="2026-Spring" /></div>
        <button class="btn-accent" :disabled="creating" @click="doCreateCollection">{{ creating ? '创建中...' : '创建' }}</button>
      </div>
    </div>

    <!-- 缴纳弹窗 -->
    <div v-if="showPayModal" class="modal-overlay" @click.self="showPayModal = false">
      <div class="modal-card">
        <div class="modal-header"><h3>缴纳班费</h3><button class="btn-close" @click="showPayModal = false">✕</button></div>
        <p class="modal-desc">{{ payTarget?.title }}</p>
        <div class="form-group"><label>金额</label><input v-model.number="payAmount" type="number" /></div>
        <button class="btn-accent" :disabled="paying" @click="doPay">{{ paying ? '缴纳中...' : '确认缴纳' }}</button>
      </div>
    </div>

    <!-- 免缴弹窗 -->
    <div v-if="showExemptModal" class="modal-overlay" @click.self="showExemptModal = false">
      <div class="modal-card">
        <div class="modal-header"><h3>标记免缴</h3><button class="btn-close" @click="showExemptModal = false">✕</button></div>
        <div class="form-group"><label>用户ID</label><input v-model.number="exemptUserId" type="number" placeholder="输入用户ID" /></div>
        <div class="form-group"><label>备注</label><input v-model="exemptRemark" placeholder="如：特困减免" /></div>
        <button class="btn-accent" @click="doExempt">确认免缴</button>
      </div>
    </div>

    <!-- 明细弹窗 -->
    <div v-if="showRecordsModal" class="modal-overlay" @click.self="showRecordsModal = false">
      <div class="modal-card modal-wide">
        <div class="modal-header"><h3>缴纳明细</h3><button class="btn-close" @click="showRecordsModal = false">✕</button></div>
        <div v-if="recordsLoading" class="loading-state">加载中...</div>
        <div v-else-if="records.length === 0" class="empty-state">暂无记录</div>
        <div v-else v-for="r in records" :key="r.id" class="record-item">
          <span class="record-name">{{ r.name || '用户' + r.user_id }} <span class="record-sid">{{ r.student_id }}</span></span>
          <span v-if="r.is_exempt" class="status-tag pending">免缴</span>
          <span v-else-if="r.paid_at" class="status-tag approved">已缴 ¥{{ Number(r.amount).toFixed(2) }}</span>
          <span v-else class="status-tag rejected">未缴</span>
        </div>
      </div>
    </div>
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

.section-actions { padding: 0 12px 10px; }
.btn-accent { width: 100%; padding: 10px; border: none; border-radius: var(--radius-sm); background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-accent:disabled { opacity: 0.5; }
.card-actions { display: flex; gap: 6px; margin-top: 8px; }
.btn-xs { padding: 4px 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text-2); font-size: 12px; cursor: pointer; }
.btn-xs:hover { background: var(--color-surface-2); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end; justify-content: center; z-index: 100; }
.modal-card { background: var(--color-surface); border-radius: 16px 16px 0 0; padding: 20px 16px; width: 100%; max-width: 500px; max-height: 70vh; overflow-y: auto; }
.modal-wide { max-width: 100%; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.modal-header h3 { margin: 0; font-size: 17px; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-2); padding: 4px; }
.modal-desc { font-size: 14px; color: var(--color-text-2); margin-bottom: 12px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; color: var(--color-text); margin-bottom: 4px; }
.form-group input { width: 100%; height: 40px; border: 1px solid var(--color-border); border-radius: 6px; padding: 0 10px; font-size: 14px; background: var(--color-surface-2); color: var(--color-text); box-sizing: border-box; }

.record-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border); font-size: 13px; }
.record-name { color: var(--color-text); }
.record-sid { color: var(--color-text-3); font-size: 11px; }
</style>
