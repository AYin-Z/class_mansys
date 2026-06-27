<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllPoints, addPointRecord } from '@/api/points'
import { getAllUsers } from '@/api/user'
import { post, del } from '@/utils/request'
import type { PointRecord } from '@/api/points'
import type { UserItem } from '@/api/user'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'
import { useRouter } from 'vue-router'

const router = useRouter()
const records = ref<PointRecord[]>([])
const loading = ref(true)
const showForm = ref(false)
const editing = ref<PointRecord | null>(null)

const form = ref({
  studentId: '',
  foundUser: null as UserItem | null,
  score: 0,
  reason: '',
  searching: false,
})
const submitting = ref(false)

async function loadData() {
  loading.value = true
  try {
    const res = await getAllPoints()
    if (res.success) records.value = res.records || []
  } catch (_) {}
  finally { loading.value = false }
}

onMounted(loadData)

function openForm() {
  form.value = { studentId: '', foundUser: null, score: 0, reason: '', searching: false }
  showForm.value = true
}

async function searchUser() {
  const sid = form.value.studentId.trim()
  if (!sid) { showToast('请输入学号'); return }
  form.value.searching = true; form.value.foundUser = null
  try {
    const res = await post('/api/auth/find-by-student', { student_id: sid })
    if (res.success && res.user) { form.value.foundUser = res.user }
    else { showToast('未找到该学号', 'error') }
  } catch (e: any) { showToast(e.message || '查找失败', 'error') }
  finally { form.value.searching = false }
}

async function handleCreate() {
  if (!form.value.foundUser) { showToast('请先查找用户'); return }
  if (!form.value.score) { showToast('请输入分值'); return }
  if (!form.value.reason.trim()) { showToast('请输入原因'); return }
  submitting.value = true
  try {
    const res = await addPointRecord({
      user_id: form.value.foundUser.id,
      score: form.value.score,
      reason: form.value.reason.trim(),
    })
    if (res.success) {
      showToast('积分添加成功')
      showForm.value = false
      await loadData()
    }
  } catch (e: any) { showToast(e.message || '添加失败', 'error') }
  finally { submitting.value = false }
}

async function handleDelete(id: number) {
  try {
    const res = await del(`/api/points/${id}`)
    if (res.success) {
      showToast('已删除')
      records.value = records.value.filter(r => r.id !== id)
    }
  } catch (e: any) { showToast(e.message || '删除失败', 'error') }
}

function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}

function goMember(id: number) {
  router.push({ path: '/pages/admin/member-detail', query: { id: String(id) } })
}
</script>

<template>
  <div class="manage-page">
    <NavBar title="积分管理" show-back />

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="records.length === 0" class="state">暂无积分记录</div>

    <div v-for="r in records" :key="r.id" class="card" @click="editing === r ? editing = null : editing = r">
      <div class="card-left">
        <div class="score" :class="{ positive: r.score > 0, negative: r.score < 0 }">
          {{ r.score > 0 ? '+' : '' }}{{ r.score }}
        </div>
      </div>
      <div class="card-body">
        <div class="card-title" @click.stop="goMember(r.user_id)">{{ r.user_name || '用户'+r.user_id }} ›</div>
        <div class="card-desc">{{ r.reason }}</div>
        <div class="card-meta">
          <span>{{ r.creator_name || '' }}</span>
          <span>{{ formatDate(r.created_at) }}</span>
        </div>
      </div>
      <button v-if="editing === r" class="del-btn" @click.stop="handleDelete(r.id)">删除</button>
    </div>

    <button class="fab" @click="openForm">添加积分</button>

    <!-- 添加积分弹窗 -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h3 class="modal-title">添加积分</h3>
        <div class="form-field">
          <span class="field-label">学号</span>
          <div class="search-row">
            <input v-model="form.studentId" class="field-input" placeholder="输入学号" @keyup.enter="searchUser" />
            <button class="search-btn" :disabled="form.searching" @click="searchUser">{{ form.searching ? '…' : '查找' }}</button>
          </div>
        </div>
        <div v-if="form.foundUser" class="found-user">
          <span class="found-icon">👤</span><span>{{ form.foundUser.name }}</span><span class="found-sid">{{ form.foundUser.student_id }}</span>
        </div>
        <label class="form-field">
          <span class="field-label">分值（正数加分，负数扣分）</span>
          <input v-model.number="form.score" type="number" class="field-input" placeholder="如 5 或 -3" />
        </label>
        <label class="form-field">
          <span class="field-label">原因</span>
          <input v-model="form.reason" class="field-input" placeholder="如 参加活动" maxlength="100" />
        </label>
        <div class="form-actions">
          <button class="btn-cancel" @click="showForm = false">取消</button>
          <button class="btn-submit" :disabled="submitting" @click="handleCreate">{{ submitting ? '提交中…' : '确认添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.card {
  display: flex; align-items: center; gap: 10px;
  margin: 8px 12px; padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card); cursor: pointer;
}
.card:active { background: var(--color-surface-hover); }
.card-left { flex-shrink: 0; min-width: 56px; text-align: center; }
.score { font-size: 18px; font-weight: 700; color: var(--color-text-3); }
.score.positive { color: var(--color-success); }
.score.negative { color: var(--color-error); }
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.card-desc { font-size: 13px; color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 11px; color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; }
.del-btn {
  flex-shrink: 0; padding: 4px 10px; border: 1px solid var(--color-error); border-radius: var(--radius-sm);
  background: transparent; color: var(--color-error); font-size: 12px; cursor: pointer;
}
.fab {
  position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%;
  border: none; background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; z-index: 50;
}
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
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
.search-row { display: flex; gap: 8px; }
.search-row .field-input { flex: 1; }
.search-btn { padding: 10px 16px; border: none; border-radius: var(--radius-sm); background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.search-btn:disabled { opacity: 0.5; }
.found-user { display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin-bottom: 16px; border-radius: var(--radius-sm); background: var(--color-accent-bg); font-size: 14px; font-weight: 600; color: var(--color-accent); }
.found-icon { font-size: 18px; }
.found-sid { font-size: 12px; color: var(--color-text-3); font-weight: 400; }
.form-actions { display: flex; gap: 10px; margin-top: 20px; }
.form-actions button { flex: 1; height: 42px; border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-cancel { background: var(--color-surface-hover); color: var(--color-text-2); }
.btn-submit { background: var(--color-accent); color: #fff; }
.btn-submit:disabled { opacity: 0.5; }
</style>
