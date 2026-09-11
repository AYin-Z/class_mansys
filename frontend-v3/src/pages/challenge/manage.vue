<script setup lang="ts">
/**
 * 擂台管理
 *
 * 2026-09（体验修复）：
 *  - 三态（loading / error+retry / empty）：catch (_) {} 不再把失败吞成「暂无擂台」
 *  - 创建 / 登记战绩改用 BaseModal + FormField（字段级错误）
 *  - 悬浮「+」按钮上移避开 TabBar（bottom: calc(var(--tabbar-h) + 16px) + z-index: var(--z-fab)）
 *  - 裁判后改为「刷新展开面板」而不是 toggleExpand（原实现会把面板折叠掉）
 *  - 写操作防重、成功 toast、失败 toastIfNotNotified；emoji ▾▸ → AppIcon
 */
import { ref, onMounted } from 'vue'
import {
  getChallenges, createChallenge, getChallengeDetail,
  judgeApplication, recordChallenge,
} from '@/api/challenge'
import { getAllUsers } from '@/api/user'
import { toastIfNotNotified } from '@/utils/request'
import type { ChallengeItem, ChallengeApplication, ChallengeRecord } from '@/api/challenge'
import type { UserItem } from '@/api/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'

const challenges = ref<ChallengeItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const showForm = ref(false)
const expandedId = ref<number | null>(null)
const expandedDetail = ref<{
  applications: ChallengeApplication[]
  records: ChallengeRecord[]
} | null>(null)
const expandedError = ref<unknown>(null)
const expanding = ref(false)

// Create form
const form = ref({ name: '', type: '', description: '' })
const formErrors = ref<{ name?: string; type?: string; description?: string }>({})
const submitting = ref(false)

// Record form
const showRecordForm = ref(false)
const recordTargetId = ref<number | null>(null)
const recordForm = ref({ challenger_id: 0, champion_id: 0, result: '', notes: '' })
const recordErrors = ref<{ challenger_id?: string; champion_id?: string; result?: string }>({})
const users = ref<UserItem[]>([])
const usersError = ref<unknown>(null)
const recording = ref(false)

async function loadChallenges() {
  loading.value = true
  error.value = null
  try {
    const res = await getChallenges()
    if (res.success) challenges.value = res.challenges || []
    else error.value = new Error('加载擂台列表失败，请稍后重试')
  } catch (e) {
    error.value = e
  }
  finally { loading.value = false }
}

/** 登记战绩的下拉选项来源：失败要显式提示，否则用户只会看到「选择挑战者」却没有选项 */
async function loadUsers() {
  usersError.value = null
  try {
    const r = await getAllUsers()
    if (r.success) users.value = r.users || []
    else usersError.value = new Error('加载成员列表失败')
  } catch (e) {
    usersError.value = e
  }
}

onMounted(async () => {
  await loadChallenges()
  await loadUsers()
})

function openForm() {
  form.value = { name: '', type: '', description: '' }
  formErrors.value = {}
  showForm.value = true
}

async function handleCreate() {
  if (submitting.value) return
  const errs: { name?: string; type?: string; description?: string } = {}
  if (!form.value.name.trim()) errs.name = '请输入擂台名称'
  if (!form.value.type.trim()) errs.type = '请输入类型'
  if (!form.value.description.trim()) errs.description = '请输入描述'
  formErrors.value = errs
  if (errs.name || errs.type || errs.description) return

  submitting.value = true
  try {
    const res = await createChallenge(form.value)
    if (res.success) {
      showToast('擂台创建成功', 'success')
      showForm.value = false
      await loadChallenges()
    } else {
      showToast('创建失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '创建失败，请稍后重试') }
  finally { submitting.value = false }
}

/** 拉取某个擂台的展开详情（裁判/登记后刷新用，不折叠面板） */
async function loadExpand(id: number) {
  expanding.value = true
  expandedError.value = null
  try {
    const res = await getChallengeDetail(id)
    if (res.success) {
      expandedDetail.value = {
        applications: res.applications || [],
        records: res.records || [],
      }
    } else {
      expandedError.value = new Error('加载擂台详情失败，请稍后重试')
    }
  } catch (e) {
    expandedError.value = e
  }
  finally { expanding.value = false }
}

async function toggleExpand(id: number) {
  if (expandedId.value === id) { expandedId.value = null; return }
  expandedId.value = id
  expandedDetail.value = null
  await loadExpand(id)
}

const judging = ref<number | null>(null)

async function handleJudge(appId: number, result: 'challenger_win' | 'champion_win' | 'reject') {
  if (judging.value !== null) return
  const target = expandedDetail.value?.applications.find(a => a.id === appId)
  const who = target?.user_name || '该申请'
  const ok = await showConfirm(
    result === 'reject' ? '驳回挑战申请' : result === 'challenger_win' ? '判定挑战成功' : '判定守擂成功',
    result === 'reject'
      ? `驳回 ${who} 的挑战申请`
      : result === 'challenger_win'
        ? `${who} 将成为新擂主`
        : `${who} 的挑战判定为失败，原擂主继续守擂`,
    {
      danger: result === 'reject',
      confirmText: result === 'reject' ? '驳回' : '确认判定',
      hint: result === 'reject' ? '驳回后申请人需要重新提交申请' : '裁判结果提交后不可更改，会同步生成战绩记录',
    },
  )
  if (!ok) return

  judging.value = appId
  try {
    const res = await judgeApplication(appId, result)
    if (res.success) {
      showToast(res.message || '裁判完成', 'success')
      if (expandedId.value) await loadExpand(expandedId.value)
    } else {
      showToast(res.message || '裁判失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '裁判失败，请稍后重试') }
  finally { judging.value = null }
}

function openRecordForm(challengeId: number) {
  recordTargetId.value = challengeId
  recordForm.value = { challenger_id: 0, champion_id: 0, result: '', notes: '' }
  recordErrors.value = {}
  showRecordForm.value = true
}

async function handleRecord() {
  if (recording.value) return
  const { challenger_id, champion_id, result } = recordForm.value
  const errs: { challenger_id?: string; champion_id?: string; result?: string } = {}
  if (!challenger_id) errs.challenger_id = '请选择挑战者'
  if (!champion_id) errs.champion_id = '请选择擂主'
  if (!result) errs.result = '请选择结果'
  recordErrors.value = errs
  if (errs.challenger_id || errs.champion_id || errs.result) return

  const challengeId = recordTargetId.value ?? expandedId.value
  if (!challengeId) return

  recording.value = true
  try {
    const res = await recordChallenge(challengeId, {
      challenger_id, champion_id, result: result === 'win' ? '挑战成功' : '守擂成功',
      notes: recordForm.value.notes || undefined,
    })
    if (res.success) {
      showToast('战绩已登记', 'success')
      showRecordForm.value = false
      await loadExpand(challengeId)
    } else {
      showToast('登记失败，请稍后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '登记失败，请稍后重试') }
  finally { recording.value = false }
}

function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="manage-page">
    <NavBar title="擂台管理" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="challenges.length === 0"
      loading-text="正在加载擂台…"
      empty-icon="trophy"
      empty-title="还没有擂台"
      empty-description="点右下角「+」创建第一个擂台"
      @retry="loadChallenges"
    >
      <div v-for="c in challenges" :key="c.id" class="card-group">
        <div class="card" @click="toggleExpand(c.id)">
          <div class="card-body">
            <div class="card-title">{{ c.name }}</div>
            <div class="card-desc">{{ c.description?.slice(0, 60) || '' }}</div>
            <div class="card-meta">
              <span class="tag">{{ c.type }}</span>
              <span>擂主: {{ c.champion_name || '无' }}</span>
              <span>{{ c.record_count || 0 }} 场</span>
            </div>
          </div>
          <AppIcon
            class="expand-icon"
            :name="expandedId === c.id ? 'chevron-down' : 'chevron-right'"
            :size="18"
          />
        </div>

        <!-- 展开详情 -->
        <div v-if="expandedId === c.id" class="expand-panel">
          <StateView
            slim
            :loading="expanding"
            :error="expandedError"
            @retry="loadExpand(c.id)"
          >
            <!-- 审核申请 -->
            <div v-if="expandedDetail?.applications?.length" class="section">
              <div class="section-title">待审核申请</div>
              <div v-for="app in expandedDetail.applications" :key="app.id" class="app-card">
                <div class="app-info">
                  <span class="app-name">{{ app.user_name }}</span>
                  <span class="app-sid">{{ app.student_id }}</span>
                  <span class="app-time">{{ formatDate(app.created_at) }}</span>
                </div>
                <div v-if="app.status === 0" class="app-actions">
                  <button class="btn-approve" :disabled="judging !== null" @click.stop="handleJudge(app.id, 'challenger_win')">挑战成功</button>
                  <button class="btn-approve alt" :disabled="judging !== null" @click.stop="handleJudge(app.id, 'champion_win')">守擂成功</button>
                  <button class="btn-reject" :disabled="judging !== null" @click.stop="handleJudge(app.id, 'reject')">驳回</button>
                </div>
                <span v-else class="app-status" :class="{ approved: app.status === 1, rejected: app.status === 2 }">
                  {{ {0:'待审',1:'已通过',2:'已拒绝'}[app.status] }}
                </span>
              </div>
            </div>

            <!-- 战绩记录 -->
            <div v-if="expandedDetail?.records?.length" class="section">
              <div class="section-title">战绩记录</div>
              <div v-for="r in expandedDetail.records" :key="r.id" class="record-item">
                <span class="rec-result" :class="{ win: r.result === '挑战成功' || r.result === 'win' }">{{ r.result }}</span>
                <span>{{ r.challenger_name }} VS {{ r.champion_name }}</span>
                <span class="rec-time">{{ formatDate(r.created_at) }}</span>
              </div>
            </div>

            <!-- 登记战绩 -->
            <button class="record-btn" @click.stop="openRecordForm(c.id)">登记战绩</button>
          </StateView>
        </div>
      </div>
    </StateView>

    <button class="fab" type="button" aria-label="创建擂台" @click="openForm">
      <AppIcon name="plus" :size="24" />
    </button>

    <!-- 创建弹窗 -->
    <BaseModal v-model="showForm" title="创建擂台" :close-on-overlay="false">
      <FormField label="名称" required :error="formErrors.name">
        <input v-model="form.name" class="field-input" placeholder="如 俯卧撑擂台" />
      </FormField>
      <FormField label="类型" required :error="formErrors.type">
        <input v-model="form.type" class="field-input" placeholder="如 体能/技能/学习" />
      </FormField>
      <FormField label="描述" required :error="formErrors.description">
        <textarea v-model="form.description" class="field-input" rows="3" placeholder="擂台规则描述"></textarea>
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" @click="showForm = false">取消</BaseButton>
        <BaseButton :loading="submitting" @click="handleCreate">创建</BaseButton>
      </template>
    </BaseModal>

    <!-- 登记战绩弹窗 -->
    <BaseModal v-model="showRecordForm" title="登记战绩" :close-on-overlay="false">
      <div v-if="usersError" class="users-error">
        <span>成员列表加载失败，暂时无法选择挑战者/擂主</span>
        <button type="button" class="users-retry" @click="loadUsers">重试</button>
      </div>
      <FormField label="挑战者" required :error="recordErrors.challenger_id">
        <select v-model="recordForm.challenger_id" class="field-input">
          <option :value="0" disabled>选择挑战者</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.student_id }})</option>
        </select>
      </FormField>
      <FormField label="擂主（被挑战者）" required :error="recordErrors.champion_id">
        <select v-model="recordForm.champion_id" class="field-input">
          <option :value="0" disabled>选择擂主</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.student_id }})</option>
        </select>
      </FormField>
      <FormField label="结果" required :error="recordErrors.result">
        <select v-model="recordForm.result" class="field-input">
          <option value="" disabled>选择结果</option>
          <option value="win">挑战成功（挑战者胜）</option>
          <option value="lose">守擂成功（擂主胜）</option>
        </select>
      </FormField>
      <FormField label="备注（选填）">
        <input v-model="recordForm.notes" class="field-input" placeholder="如 2:1 获胜" />
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" @click="showRecordForm = false">取消</BaseButton>
        <BaseButton :loading="recording" @click="handleRecord">登记</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.manage-page { min-height: 100vh; background: var(--color-bg); }

.card-group { margin: 8px 12px; }
.card {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card); cursor: pointer;
  margin-bottom: 4px;
}
.card:active { background: var(--color-surface-hover); }
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.card-desc { font-size: var(--font-size-sm); color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tag { font-size: var(--font-size-xs); font-weight: 600; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--color-accent-bg); color: var(--color-accent); }
.expand-icon { color: var(--color-text-3); flex-shrink: 0; }

.expand-panel {
  margin: 0 0 8px; padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
}
.section { margin-bottom: 12px; }
.section-title { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-2); margin-bottom: 8px; }
.app-card {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; margin-bottom: 4px; border-radius: var(--radius-sm);
  background: var(--color-bg); font-size: var(--font-size-sm); flex-wrap: wrap;
}
.app-info { display: flex; gap: 8px; align-items: center; }
.app-name { font-weight: 600; color: var(--color-text); }
.app-sid, .app-time { font-size: var(--font-size-xs); color: var(--color-text-3); }
.app-actions { display: flex; gap: 6px; }
.btn-approve, .btn-reject {
  min-height: 44px; padding: 6px 12px; border: none; border-radius: var(--radius-sm);
  font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; font-family: inherit;
}
.btn-approve { background: var(--color-success-bg); color: var(--color-success); }
.btn-approve.alt { background: var(--color-accent-bg); color: var(--color-accent); }
.btn-reject { background: var(--color-error-bg); color: var(--color-error); }
.btn-approve:disabled, .btn-reject:disabled { opacity: 0.55; cursor: not-allowed; }
.app-status { font-size: var(--font-size-xs); font-weight: 600; }
.app-status.approved { color: var(--color-success); }
.app-status.rejected { color: var(--color-error); }

.record-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; font-size: var(--font-size-sm); color: var(--color-text-2);
}
.rec-result { font-size: var(--font-size-xs); font-weight: 600; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--color-surface-hover); }
.rec-result.win { background: var(--color-success-bg); color: var(--color-success); }
.rec-time { font-size: var(--font-size-xs); color: var(--color-text-3); margin-left: auto; }

.record-btn {
  width: 100%; min-height: 44px; padding: 8px; border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm); background: transparent;
  color: var(--color-accent); font-size: var(--font-size-sm); font-weight: 600;
  cursor: pointer; font-family: inherit;
}

/* 悬浮「+」：上移避开 TabBar */
.fab {
  position: fixed; bottom: calc(var(--tabbar-h) + 16px); right: 24px;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--color-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-lift); cursor: pointer; z-index: var(--z-fab);
}
.fab:active { opacity: 0.9; }

.field-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--font-size-body); color: var(--color-text);
  background: var(--color-surface); outline: none; box-sizing: border-box;
  font-family: inherit;
}
.field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
textarea.field-input { resize: vertical; }
.users-error {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; margin-bottom: 12px; border-radius: var(--radius-sm);
  background: var(--color-error-bg); color: var(--color-error);
  font-size: var(--font-size-sm); line-height: 1.4;
}
.users-retry {
  flex-shrink: 0; min-height: 44px; padding: 6px 12px; border: none;
  border-radius: var(--radius-sm); background: var(--color-error); color: #fff;
  font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; font-family: inherit;
}
</style>
