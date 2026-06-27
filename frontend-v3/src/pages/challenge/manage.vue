<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getChallenges, createChallenge, getChallengeDetail,
  judgeApplication, recordChallenge,
} from '@/api/challenge'
import { getAllUsers } from '@/api/user'
import type { ChallengeItem, ChallengeApplication, ChallengeRecord } from '@/api/challenge'
import type { UserItem } from '@/api/user'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const challenges = ref<ChallengeItem[]>([])
const loading = ref(true)
const showForm = ref(false)
const expandedId = ref<number | null>(null)
const expandedDetail = ref<{
  applications: ChallengeApplication[]
  records: ChallengeRecord[]
} | null>(null)
const expanding = ref(false)

// Create form
const form = ref({ name: '', type: '', description: '' })
const submitting = ref(false)

// Record form
const showRecordForm = ref(false)
const recordForm = ref({ challenger_id: 0, champion_id: 0, result: '', notes: '' })
const users = ref<UserItem[]>([])
const recording = ref(false)

async function loadChallenges() {
  loading.value = true
  try {
    const res = await getChallenges()
    if (res.success) challenges.value = res.challenges || []
  } catch (_) {}
  finally { loading.value = false }
}

onMounted(async () => {
  await loadChallenges()
  try {
    const r = await getAllUsers()
    if (r.success) users.value = r.users || []
  } catch (_) {}
})

function openForm() {
  form.value = { name: '', type: '', description: '' }
  showForm.value = true
}

async function handleCreate() {
  if (!form.value.name.trim()) { showToast('请输入擂台名称'); return }
  if (!form.value.type.trim()) { showToast('请输入类型'); return }
  if (!form.value.description.trim()) { showToast('请输入描述'); return }
  submitting.value = true
  try {
    const res = await createChallenge(form.value)
    if (res.success) {
      showToast('擂台创建成功')
      showForm.value = false
      await loadChallenges()
    }
  } catch (e: any) { showToast(e.message || '创建失败', 'error') }
  finally { submitting.value = false }
}

async function toggleExpand(id: number) {
  if (expandedId.value === id) { expandedId.value = null; return }
  expandedId.value = id
  expanding.value = true
  expandedDetail.value = null
  try {
    const res = await getChallengeDetail(id)
    if (res.success) {
      expandedDetail.value = {
        applications: res.applications || [],
        records: res.records || [],
      }
    }
  } catch (_) {}
  finally { expanding.value = false }
}

const judging = ref<number | null>(null)

async function handleJudge(appId: number, result: 'challenger_win' | 'champion_win' | 'reject') {
  if (judging.value !== null) return
  judging.value = appId
  try {
    const res = await judgeApplication(appId, result)
    if (res.success) {
      showToast(res.message || '裁判完成')
      if (expandedId.value) await toggleExpand(expandedId.value)
    }
  } catch (e: any) { showToast(e.message || '操作失败', 'error') }
  finally { judging.value = null }
}

function openRecordForm(challengeId: number) {
  recordForm.value = { challenger_id: 0, champion_id: 0, result: '', notes: '' }
  showRecordForm.value = true
}

async function handleRecord() {
  const { challenger_id, champion_id, result } = recordForm.value
  if (!challenger_id || !champion_id || !result) {
    showToast('请填写完整信息'); return
  }
  recording.value = true
  try {
    const res = await recordChallenge(expandedId.value!, {
      challenger_id, champion_id, result: result === 'win' ? '挑战成功' : '守擂成功',
      notes: recordForm.value.notes || undefined,
    })
    if (res.success) {
      showToast('战绩已登记')
      showRecordForm.value = false
      if (expandedId.value) await toggleExpand(expandedId.value)
    }
  } catch (e: any) { showToast(e.message || '登记失败', 'error') }
  finally { recording.value = false }
}

function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}
function getUserName(id: number) {
  return users.value.find(u => u.id === id)?.name || `用户${id}`
}
</script>

<template>
  <div class="manage-page">
    <NavBar title="擂台管理" show-back />

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="challenges.length === 0" class="state">暂无擂台</div>

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
        <span class="expand-icon">{{ expandedId === c.id ? '▾' : '▸' }}</span>
      </div>

      <!-- 展开详情 -->
      <div v-if="expandedId === c.id && !expanding" class="expand-panel">
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
              <button class="btn-approve" style="background:var(--color-accent-bg);color:var(--color-accent)" :disabled="judging !== null" @click.stop="handleJudge(app.id, 'champion_win')">守擂成功</button>
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
      </div>
    </div>

    <button class="fab" @click="openForm">创建擂台</button>

    <!-- 创建弹窗 -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h3 class="modal-title">创建擂台</h3>
        <label class="form-field">
          <span class="field-label">名称</span>
          <input v-model="form.name" class="field-input" placeholder="如 俯卧撑擂台" />
        </label>
        <label class="form-field">
          <span class="field-label">类型</span>
          <input v-model="form.type" class="field-input" placeholder="如 体能/技能/学习" />
        </label>
        <label class="form-field">
          <span class="field-label">描述</span>
          <textarea v-model="form.description" class="field-input" rows="3" placeholder="擂台规则描述" style="resize:vertical"></textarea>
        </label>
        <div class="form-actions">
          <button class="btn-cancel" @click="showForm = false">取消</button>
          <button class="btn-submit" :disabled="submitting" @click="handleCreate">
            {{ submitting ? '创建中…' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 登记战绩弹窗 -->
    <div v-if="showRecordForm" class="overlay" @click.self="showRecordForm = false">
      <div class="modal">
        <h3 class="modal-title">登记战绩</h3>
        <label class="form-field">
          <span class="field-label">挑战者</span>
          <select v-model="recordForm.challenger_id" class="field-input">
            <option :value="0" disabled>选择挑战者</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.student_id }})</option>
          </select>
        </label>
        <label class="form-field">
          <span class="field-label">擂主（被挑战者）</span>
          <select v-model="recordForm.champion_id" class="field-input">
            <option :value="0" disabled>选择擂主</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.student_id }})</option>
          </select>
        </label>
        <label class="form-field">
          <span class="field-label">结果</span>
          <select v-model="recordForm.result" class="field-input">
            <option value="" disabled>选择结果</option>
            <option value="win">挑战成功（挑战者胜）</option>
            <option value="lose">守擂成功（擂主胜）</option>
          </select>
        </label>
        <label class="form-field">
          <span class="field-label">备注（选填）</span>
          <input v-model="recordForm.notes" class="field-input" placeholder="如 2:1 获胜" />
        </label>
        <div class="form-actions">
          <button class="btn-cancel" @click="showRecordForm = false">取消</button>
          <button class="btn-submit" :disabled="recording" @click="handleRecord">
            {{ recording ? '提交中…' : '登记' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

.card-group { margin: 0 12px 4px; }
.card {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card); cursor: pointer;
  margin-bottom: 4px;
}
.card:active { background: var(--color-surface-hover); }
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.card-desc { font-size: 13px; color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 11px; color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; align-items: center; }
.tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--color-accent-bg); color: var(--color-accent); }
.expand-icon { font-size: 16px; color: var(--color-text-3); flex-shrink: 0; }

.expand-panel {
  margin: 0 0 8px; padding: 12px 14px; border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
}
.section { margin-bottom: 12px; }
.section-title { font-size: 12px; font-weight: 600; color: var(--color-text-2); margin-bottom: 8px; }
.app-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; margin-bottom: 4px; border-radius: var(--radius-sm);
  background: var(--color-bg); font-size: 13px;
}
.app-info { display: flex; gap: 8px; align-items: center; }
.app-name { font-weight: 600; color: var(--color-text); }
.app-sid { font-size: 11px; color: var(--color-text-3); }
.app-time { font-size: 11px; color: var(--color-text-3); }
.app-actions { display: flex; gap: 6px; }
.btn-approve, .btn-reject {
  padding: 3px 10px; border: none; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600; cursor: pointer;
}
.btn-approve { background: #dcfce7; color: #16a34a; }
.btn-reject { background: var(--color-error-bg); color: var(--color-error); }
.app-status { font-size: 11px; font-weight: 600; }
.app-status.approved { color: #16a34a; }
.app-status.rejected { color: var(--color-error); }

.record-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; font-size: 13px; color: var(--color-text-2);
}
.rec-result { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--color-surface-hover); }
.rec-result.win { background: #dcfce7; color: #16a34a; }
.rec-time { font-size: 11px; color: var(--color-text-3); margin-left: auto; }

.record-btn {
  width: 100%; padding: 8px; border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm); background: transparent;
  color: var(--color-accent); font-size: 13px; cursor: pointer;
}

.fab {
  position: fixed; bottom: 24px; right: 24px;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; z-index: 50;
}

.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  overflow-y: auto;
}
.modal {
  background: var(--color-surface); border-radius: var(--radius-lg); padding: 24px;
  width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.modal-title { font-size: 18px; font-weight: 700; color: var(--color-text); margin-bottom: 20px; text-align: center; }
.form-field { display: block; margin-bottom: 16px; }
.field-label { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-2); margin-bottom: 6px; }
.field-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text);
  background: var(--color-bg); outline: none; box-sizing: border-box;
}
.field-input:focus { border-color: var(--color-accent); }
.form-actions { display: flex; gap: 10px; margin-top: 20px; }
.form-actions button {
  flex: 1; height: 42px; border: none; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-cancel { background: var(--color-surface-hover); color: var(--color-text-2); }
.btn-submit { background: var(--color-accent); color: #fff; }
.btn-submit:disabled { opacity: 0.5; }
</style>
