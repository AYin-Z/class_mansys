<script setup lang="ts">
/**
 * 班费（收缴 / 报销 / 公示）
 *
 * 2026-09（B3）修复：
 *  - 免缴：此前弹窗要求手输数据库内部「用户ID」，且页面里那个防误操作的
 *    confirmExemptUser() 从未被调用（死代码）→ 一旦填错就是把免缴记到别人头上，
 *    还不可撤销。现在改成从本批次名单里按「学号 / 姓名」搜索选择 + 二次确认 + loading。
 *  - 缴纳成功无任何反馈（学员不确定缴没缴上，可能重复缴纳）→ 补成功提示。
 *  - 「发起收缴」校验失败静默 return（点了没反应），金额还能填 0/负数 → 字段级提示。
 *  - 「截止」用原生 confirm 且不带批次名 → 换 showConfirm，写清对象与后果。
 *  - 余额/收支在加载失败时静默显示 ¥0（会误导干部）→ 失败显示 `--` 并可重试。
 *  - 原生 alert / 手写弹窗 / emoji 图标 / 硬编码色值 → 统一到组件与令牌。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  closeCollection, createCollection, createPublication, exemptCollection,
  getCollectionRecords, getCollections, getMyExpenses, getPublications, getSummary, payCollection,
} from '@/api/fee'
import type { FeeCollection, FeeCollectionRecord, FeeExpense, FeePublication } from '@/api/fee'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const router = useRouter()
const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)
// 权限显隐统一走后端可配置权限矩阵（不再硬编码角色）
const canManageCollection = computed(() => userStore.hasPermission('COLLECT_FEE'))
const canBookkeep = computed(() => userStore.hasPermission('BOOKKEEP_FEE'))

const expenses = ref<FeeExpense[]>([])
const collections = ref<FeeCollection[]>([])
const publications = ref<FeePublication[]>([])
const balance = ref<number | null>(0)
const totalIncome = ref<number | null>(0)
const totalExpense = ref<number | null>(0)
const pendingCount = ref(0)
const loading = ref(true)
const error = ref<unknown>(null)
const summaryFailed = ref(false)
const tab = ref<'expense' | 'collection' | 'publication'>('expense')

const showCreateModal = ref(false)
const newCollection = ref({ title: '', amount: 0, semester: '' })
const creating = ref(false)
const createErrors = ref<Record<string, string>>({})

const showPayModal = ref(false)
const payTarget = ref<FeeCollection | null>(null)
const payAmount = ref(0)
const paying = ref(false)

const showExemptModal = ref(false)
const exemptTarget = ref<FeeCollection | null>(null)
const exemptKeyword = ref('')
const exemptPicked = ref<FeeCollectionRecord | null>(null)
const exemptRemark = ref('')
const exemptMembers = ref<FeeCollectionRecord[]>([])
const exemptLoading = ref(false)
const exemptSaving = ref(false)
const exemptError = ref<unknown>(null)

const showRecordsModal = ref(false)
const recordsTarget = ref<FeeCollection | null>(null)
const records = ref<FeeCollectionRecord[]>([])
const recordsLoading = ref(false)
const recordsError = ref<unknown>(null)

const showPubModal = ref(false)
const pubForm = ref({ title: '', period: '' })
const pubSaving = ref(false)

onMounted(async () => {
  // 干部默认看收缴，学员默认看自己的报销
  tab.value = canManageCollection.value ? 'collection' : 'expense'
  await loadData()
})

async function loadData() {
  loading.value = true
  error.value = null
  summaryFailed.value = false
  try {
    const [expRes, sumRes, colRes, pubRes] = await Promise.all([
      getMyExpenses().catch(() => null),
      getSummary().catch(() => null),
      getCollections().catch(() => null),
      getPublications().catch(() => null),
    ])
    // 至少列表能出来就不算整页失败；但余额/待办类数字失败时必须显示「--」而不是 0
    if (expRes?.success) expenses.value = expRes.expenses || []
    if (colRes?.success) collections.value = colRes.collections || colRes.data?.collections || []
    if (pubRes?.success) publications.value = pubRes.publications || pubRes.data?.publications || []
    if (sumRes?.success) {
      const s = sumRes.data?.summary || sumRes.summary || sumRes || {}
      balance.value = Number(s.balance ?? 0)
      totalIncome.value = Number(s.totalIncome ?? 0)
      totalExpense.value = Number(s.totalExpense ?? 0)
      pendingCount.value = (s.pending_small || 0) + (s.pending_medium || 0) + (s.pending_large || 0)
    } else {
      summaryFailed.value = true
      balance.value = null
      totalIncome.value = null
      totalExpense.value = null
    }
    if (!expRes && !colRes && !pubRes && !sumRes) {
      error.value = new Error('班费数据加载失败')
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

const money = (v: number | null) => (v === null || v === undefined ? '--' : Number(v).toFixed(2))
const statusLabel = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const statusVariant = (s: number) => (['warning', 'success', 'danger'][s] || 'default') as 'warning' | 'success' | 'danger' | 'default'

function goApply() { router.push('/pages/fee/expense-apply') }
function goDetail(id: number) { router.push({ path: '/pages/fee/expense-detail', query: { id: String(id) } }) }
function goApprovals() { router.push('/pages/fee/approvals') }
function goPublicationDetail(id: number) {
  router.push({ path: '/pages/fee/publication-detail', query: { id: String(id) } })
}

// ——— 发起收缴 ———
function openCreate() {
  newCollection.value = { title: '', amount: 0, semester: '' }
  createErrors.value = {}
  showCreateModal.value = true
}

function validateCreate(): boolean {
  const e: Record<string, string> = {}
  if (!newCollection.value.title.trim()) e.title = '请填写收缴标题'
  const amount = Number(newCollection.value.amount)
  if (!amount || amount <= 0) e.amount = '人均金额需大于 0'
  else if (amount > 10000) e.amount = '人均金额看起来过大，请确认'
  if (!newCollection.value.semester.trim()) e.semester = '请填写学期，如 2026-Spring'
  createErrors.value = e
  return Object.keys(e).length === 0
}

async function doCreateCollection() {
  if (creating.value) return
  if (!validateCreate()) return
  creating.value = true
  try {
    await createCollection({
      title: newCollection.value.title.trim(),
      amount_per_person: Number(newCollection.value.amount),
      semester: newCollection.value.semester.trim(),
    })
    showCreateModal.value = false
    showToast('收缴已发起，学员端可以开始缴费', 'success')
    await loadData()
  } catch (e) {
    toastIfNotNotified(e, '创建失败，请稍后重试')
  } finally {
    creating.value = false
  }
}

// ——— 缴纳 ———
function openPay(c: FeeCollection) {
  payTarget.value = c
  payAmount.value = Number(c.amount_per_person)
  showPayModal.value = true
}

async function doPay() {
  if (paying.value) return
  if (!payTarget.value) return
  if (!payAmount.value || payAmount.value <= 0) {
    showToast('缴纳金额异常，请联系生活副区', 'error')
    return
  }
  paying.value = true
  try {
    await payCollection(payTarget.value.id, payAmount.value)
    showPayModal.value = false
    showToast(`缴纳成功：¥${Number(payAmount.value).toFixed(2)}`, 'success')
    await loadData()
  } catch (e) {
    toastIfNotNotified(e, '缴纳失败，请稍后重试')
  } finally {
    paying.value = false
  }
}

// ——— 免缴（按学号/姓名搜索，杜绝手输内部 ID） ———
async function openExempt(c: FeeCollection) {
  exemptTarget.value = c
  exemptKeyword.value = ''
  exemptPicked.value = null
  exemptRemark.value = ''
  exemptMembers.value = []
  exemptError.value = null
  showExemptModal.value = true
  exemptLoading.value = true
  try {
    const res: any = await getCollectionRecords(c.id)
    exemptMembers.value = res?.records || res?.data?.records || []
  } catch (e) {
    exemptError.value = e
  } finally {
    exemptLoading.value = false
  }
}

const exemptMatches = computed(() => {
  const kw = exemptKeyword.value.trim().toLowerCase()
  if (!kw) return exemptMembers.value.slice(0, 8)
  return exemptMembers.value
    .filter((m) => {
      const sid = String(m.student_id || '').toLowerCase()
      const name = String(m.name || '').toLowerCase()
      return sid.includes(kw) || name.includes(kw)
    })
    .slice(0, 8)
})

async function doExempt() {
  if (exemptSaving.value) return
  const member = exemptPicked.value
  if (!member) {
    showToast('请先搜索并选择要免缴的同学', 'error')
    return
  }
  const label = `${member.student_id || ''} ${member.name || ('用户 #' + member.user_id)}`.trim()
  const ok = await showConfirm(
    '标记免缴',
    `确认给「${label}」在本批次「${exemptTarget.value?.title || ''}」标记免缴？`,
    { danger: true, confirmText: '确认免缴', hint: '免缴后该同学不再计入应缴，且无法撤销，请核对学号姓名' },
  )
  if (!ok) return
  exemptSaving.value = true
  try {
    await exemptCollection(exemptTarget.value!.id, member.user_id, exemptRemark.value)
    showExemptModal.value = false
    showToast(`已标记免缴：${label}`, 'success')
    await loadData()
  } catch (e) {
    toastIfNotNotified(e, '标记免缴失败，请稍后重试')
  } finally {
    exemptSaving.value = false
  }
}

// ——— 截止 ———
async function doClose(c: FeeCollection) {
  const ok = await showConfirm(
    '截止收缴',
    `确认截止「${c.title}」？`,
    { confirmText: '确认截止', hint: '截止后学员不能再缴纳，未缴名单将固定下来' },
  )
  if (!ok) return
  try {
    await closeCollection(c.id)
    showToast('已截止该批次', 'success')
    await loadData()
  } catch (e) {
    toastIfNotNotified(e, '截止失败，请稍后重试')
  }
}

// ——— 明细 ———
async function openRecords(c: FeeCollection) {
  recordsTarget.value = c
  records.value = []
  recordsError.value = null
  showRecordsModal.value = true
  recordsLoading.value = true
  try {
    const res: any = await getCollectionRecords(c.id)
    records.value = res?.records || res?.data?.records || []
  } catch (e) {
    recordsError.value = e
  } finally {
    recordsLoading.value = false
  }
}

// ——— 发布公示 ———
async function doPublish() {
  if (pubSaving.value) return
  if (!pubForm.value.title.trim()) { showToast('请填写公示标题', 'error'); return }
  pubSaving.value = true
  try {
    await createPublication(pubForm.value.title.trim(), pubForm.value.period.trim())
    showToast('公示已发布，学员端可见', 'success')
    showPubModal.value = false
    pubForm.value = { title: '', period: '' }
    await loadData()
  } catch (e) {
    toastIfNotNotified(e, '发布失败，请稍后重试')
  } finally {
    pubSaving.value = false
  }
}
</script>

<template>
  <div class="fee-page">
    <NavBar title="班费" />

    <!-- 余额卡片：加载失败显示 -- 而不是 0，避免误判 -->
    <div class="balance-card">
      <div class="balance-label">当前余额</div>
      <div class="balance-amount">¥{{ money(balance) }}</div>
      <div class="balance-sub">
        <span>收 {{ money(totalIncome) }}</span>
        <span>支 {{ money(totalExpense) }}</span>
      </div>
      <button v-if="summaryFailed" class="balance-retry" type="button" @click="loadData">
        数据加载失败，点击重试
      </button>
    </div>

    <!-- 快捷入口 -->
    <div class="quick-actions">
      <button class="quick-item" type="button" @click="goApply">
        <AppIcon name="file" :size="20" />
        <span class="qi-label">申请报销</span>
      </button>
      <button class="quick-item" type="button" @click="goApprovals">
        <AppIcon name="clipboard" :size="20" />
        <span class="qi-label">
          审批 / 投票
          <span v-if="pendingCount > 0" class="badge">{{ pendingCount }}</span>
        </span>
      </button>
    </div>

    <div class="tab-bar" role="tablist">
      <button v-if="canManageCollection" :class="['tab', { active: tab === 'collection' }]" type="button" @click="tab = 'collection'">收缴</button>
      <button :class="['tab', { active: tab === 'expense' }]" type="button" @click="tab = 'expense'">我的报销</button>
      <button :class="['tab', { active: tab === 'publication' }]" type="button" @click="tab = 'publication'">公示</button>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      empty-title="这里还没有数据"
      @retry="loadData"
    >
      <!-- 收缴 -->
      <template v-if="tab === 'collection'">
        <div v-if="canManageCollection" class="section-actions">
          <BaseButton block @click="openCreate">
            <AppIcon name="plus" :size="16" /> 发起收缴
          </BaseButton>
        </div>
        <StateView
          v-if="collections.length === 0"
          empty
          empty-icon="wallet"
          empty-title="还没有收缴批次"
          empty-description="发起收缴后，全班同学会看到应缴金额"
          :empty-action-text="canManageCollection ? '发起收缴' : ''"
          @empty-action="openCreate"
        />
        <div v-for="c in collections" :key="c.id" class="card">
          <div class="card-row">
            <span class="card-title">{{ c.title }}</span>
            <BaseBadge :variant="c.status === 2 ? 'success' : c.status === 1 ? 'default' : 'warning'">
              {{ c.status === 2 ? '已结清' : c.status === 1 ? '已截止' : '收集中' }}
            </BaseBadge>
          </div>
          <div class="card-row sub">
            <span>人均 ¥{{ Number(c.amount_per_person).toFixed(2) }}</span>
            <span>已收 ¥{{ Number(c.collected_amount).toFixed(2) }}</span>
            <span>预期 ¥{{ Number(c.total_expected).toFixed(2) }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: (c.total_expected > 0 ? Math.min(100, Number(c.collected_amount) / Number(c.total_expected) * 100) : 0) + '%' }"
            />
          </div>
          <div class="card-actions">
            <span v-if="c.my_paid_amount" class="paid-tag">
              <AppIcon name="check" :size="13" /> 已缴 ¥{{ Number(c.my_paid_amount).toFixed(2) }}
            </span>
            <span v-else-if="c.my_exempt" class="paid-tag exempt">免缴</span>
            <BaseButton
              v-if="c.status === 0 && !c.my_paid_amount && !c.my_exempt"
              size="sm"
              @click="openPay(c)"
            >
              <AppIcon name="money" :size="14" /> 缴纳
            </BaseButton>
            <BaseButton v-if="canManageCollection && c.status === 0" size="sm" variant="secondary" @click="openExempt(c)">
              免缴
            </BaseButton>
            <BaseButton v-if="canManageCollection && c.status === 0" size="sm" variant="ghost" @click="doClose(c)">
              截止
            </BaseButton>
            <BaseButton v-if="isAdmin" size="sm" variant="ghost" @click="openRecords(c)">
              明细
            </BaseButton>
          </div>
        </div>
      </template>

      <!-- 我的报销 -->
      <template v-if="tab === 'expense'">
        <StateView
          v-if="expenses.length === 0"
          empty
          empty-icon="file"
          empty-title="还没有报销记录"
          empty-description="垫付班费后可在这里申请报销，≤100 元由区队长审批"
          empty-action-text="申请报销"
          @empty-action="goApply"
        />
        <div v-for="e in expenses" :key="e.id" class="card" @click="goDetail(e.id)">
          <div class="card-row">
            <span class="card-title">{{ e.purpose }}</span>
            <BaseBadge :variant="statusVariant(e.status)">{{ statusLabel(e.status) }}</BaseBadge>
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
        <div v-if="canBookkeep" class="section-actions">
          <BaseButton block @click="showPubModal = true">
            <AppIcon name="megaphone" :size="16" /> 发布公示
          </BaseButton>
        </div>
        <StateView
          v-if="publications.length === 0"
          empty
          empty-icon="megaphone"
          empty-title="还没有班费公示"
          empty-description="生活副区会定期公示本区队收支情况"
        />
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
    </StateView>

    <!-- 发起收缴 -->
    <BaseModal v-model="showCreateModal" title="发起收缴">
      <FormField label="收缴标题" required :error="createErrors.title">
        <input v-model="newCollection.title" placeholder="如：2026 春季班费" />
      </FormField>
      <FormField label="人均金额（元）" required :error="createErrors.amount" hint="全班同学都会看到这个金额">
        <input v-model.number="newCollection.amount" type="number" inputmode="decimal" placeholder="0.00" />
      </FormField>
      <FormField label="学期" required :error="createErrors.semester">
        <input v-model="newCollection.semester" placeholder="如：2026-Spring" />
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" @click="showCreateModal = false">取消</BaseButton>
        <BaseButton :loading="creating" @click="doCreateCollection">创建</BaseButton>
      </template>
    </BaseModal>

    <!-- 缴纳 -->
    <BaseModal v-model="showPayModal" title="缴纳班费">
      <p class="modal-desc">{{ payTarget?.title }}</p>
      <FormField label="应缴金额" hint="金额由收缴批次的人均标准决定，如需调整请联系生活副区">
        <input :value="payAmount" type="number" readonly />
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" :disabled="paying" @click="showPayModal = false">取消</BaseButton>
        <BaseButton :loading="paying" @click="doPay">确认缴纳</BaseButton>
      </template>
    </BaseModal>

    <!-- 免缴：按学号/姓名搜索选择，避免填错人 -->
    <BaseModal v-model="showExemptModal" title="标记免缴" danger :close-on-overlay="false">
      <FormField label="选择同学" required hint="输入学号或姓名搜索，只能从本批次名单中选择">
        <input v-model="exemptKeyword" placeholder="学号 / 姓名" />
      </FormField>
      <div v-if="exemptLoading" class="pick-loading">正在加载本批次名单…</div>
      <div v-else-if="exemptError" class="pick-empty">
        名单加载失败，请关闭后重试
      </div>
      <div v-else-if="exemptMembers.length === 0" class="pick-empty">
        该批次还没有产生应缴名单
      </div>
      <template v-else>
        <div v-if="exemptMatches.length === 0" class="pick-empty">没有匹配「{{ exemptKeyword }}」的同学</div>
        <div v-else class="pick-list">
          <button
            v-for="m in exemptMatches"
            :key="m.id"
            type="button"
            class="pick-item"
            :class="{ picked: exemptPicked?.id === m.id }"
            @click="exemptPicked = m"
          >
            <span class="pick-name">{{ m.name || ('用户 #' + m.user_id) }}</span>
            <span class="pick-sid">{{ m.student_id }}</span>
            <AppIcon v-if="exemptPicked?.id === m.id" name="check" :size="16" />
          </button>
        </div>
      </template>
      <FormField label="备注" hint="例如：特困减免（学员不可见）">
        <input v-model="exemptRemark" placeholder="选填" />
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" :disabled="exemptSaving" @click="showExemptModal = false">取消</BaseButton>
        <BaseButton variant="danger" :loading="exemptSaving" :disabled="!exemptPicked" @click="doExempt">
          确认免缴
        </BaseButton>
      </template>
    </BaseModal>

    <!-- 发布公示 -->
    <BaseModal v-model="showPubModal" title="发布班费公示">
      <FormField label="标题" required>
        <input v-model="pubForm.title" placeholder="如：2026 春季班费收支公示" />
      </FormField>
      <FormField label="周期" hint="选填，如 2026-09">
        <input v-model="pubForm.period" placeholder="2026-09" />
      </FormField>
      <p class="modal-hint">公示只汇总<b>本区队</b>的收支（含已截止批次实收金额），发布后学员可见。</p>
      <template #footer>
        <BaseButton variant="secondary" @click="showPubModal = false">取消</BaseButton>
        <BaseButton :loading="pubSaving" @click="doPublish">发布</BaseButton>
      </template>
    </BaseModal>

    <!-- 缴纳明细 -->
    <BaseModal v-model="showRecordsModal" :title="`缴纳明细 · ${recordsTarget?.title || ''}`" max-width="420px">
      <div v-if="recordsLoading" class="pick-loading">加载中…</div>
      <div v-else-if="recordsError" class="pick-empty">明细加载失败，请关闭后重试</div>
      <div v-else-if="records.length === 0" class="pick-empty">本批次还没有缴纳记录</div>
      <div v-else class="record-list">
        <div v-for="r in records" :key="r.id" class="record-item">
          <span class="record-name">
            {{ r.name || '用户' + r.user_id }}
            <span class="record-sid">{{ r.student_id }}</span>
          </span>
          <BaseBadge v-if="r.is_exempt" variant="warning">免缴</BaseBadge>
          <BaseBadge v-else-if="r.paid_at" variant="success">已缴 ¥{{ Number(r.amount).toFixed(2) }}</BaseBadge>
          <BaseBadge v-else variant="danger">未缴</BaseBadge>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.fee-page { min-height: 100vh; background: var(--color-bg); padding-bottom: var(--spacing-lg); }

.balance-card {
  margin: 16px 12px;
  padding: 20px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-hero-from), var(--color-hero-to));
  color: #fff;
  text-align: center;
  box-shadow: var(--shadow-lift);
}
.balance-label { font-size: var(--font-size-sm); opacity: 0.85; }
.balance-amount { font-size: 34px; font-weight: 700; margin: 4px 0; }
.balance-sub { font-size: var(--font-size-xs); opacity: 0.8; display: flex; gap: 16px; justify-content: center; }
.balance-retry {
  margin-top: 10px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: transparent;
  color: #fff;
  font-size: var(--font-size-xs);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.quick-actions { display: flex; gap: 10px; padding: 0 12px; margin-bottom: 16px; }
.quick-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 72px;
  justify-content: center;
  padding: 14px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-2);
  cursor: pointer;
  font-family: inherit;
}
.quick-item:active { background: var(--color-surface-hover); }
.qi-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text-2); }
.badge {
  display: inline-block;
  background: var(--color-error);
  color: #fff;
  font-size: var(--font-size-2xs);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  margin-left: 4px;
}

.tab-bar { display: flex; gap: 6px; padding: 0 16px; margin-bottom: 12px; }
.tab {
  min-height: 36px;
  padding: 6px 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-2);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }

.card {
  margin: 0 12px 8px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  cursor: pointer;
}
.card-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px; }
.card-row.sub { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 6px; }
.card-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.card-muted { font-size: var(--font-size-xs); color: var(--color-text-3); }

.progress-bar { height: 4px; background: var(--color-border); border-radius: var(--radius-full); margin-top: 8px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-accent); border-radius: var(--radius-full); transition: width var(--dur-base); }

.section-actions { padding: 0 12px 10px; }
.card-actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
.paid-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-xs);
  color: var(--color-success);
}
.paid-tag.exempt { color: var(--color-warning); }

.modal-desc { font-size: var(--font-size-body); color: var(--color-text-2); margin-bottom: 12px; }
.modal-hint { font-size: var(--font-size-xs); color: var(--color-text-3); line-height: 1.5; margin-top: 4px; }
.modal-hint b { color: var(--color-text-2); }

.pick-loading, .pick-empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-3);
  padding: 10px 0 12px;
}
.pick-list { max-height: 200px; overflow-y: auto; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.pick-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-body);
  cursor: pointer;
  text-align: left;
}
.pick-item.picked { border-color: var(--color-accent); background: var(--color-accent-bg); color: var(--color-accent); }
.pick-name { flex: 1; }
.pick-sid { font-size: var(--font-size-xs); color: var(--color-text-3); }

.record-list { display: flex; flex-direction: column; }
.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}
.record-name { color: var(--color-text); }
.record-sid { color: var(--color-text-3); font-size: var(--font-size-2xs); margin-left: 4px; }
</style>
