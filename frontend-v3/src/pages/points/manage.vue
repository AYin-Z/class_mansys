<script setup lang="ts">
/**
 * 积分管理（干部）
 *
 * 2026-09（B7）修复：
 *  - `catch (_) {}` 把加载失败吞成「暂无积分记录」——干部会以为班里的积分数据全没了。
 *    现在 error + StateView 重试，空态与错误态分得清。
 *  - 删除积分记录此前点一下就直接删（不可恢复），没有二次确认、没有防重：
 *    现在 showConfirm 写清「谁的分 + 多少分 + 不可恢复」，并带 loading 防止连点。
 *  - 手写遮罩弹窗 → BaseModal（ESC/遮罩/无障碍统一），字段用 FormField 做字段级校验。
 *  - 悬浮按钮定位改 bottom: calc(var(--tabbar-h) + 16px) + z-index: var(--z-fab)，
 *    emoji 图标换 AppIcon，去掉手写 80px 底部避让。
 */
import { ref, onMounted, computed } from 'vue'
import { getAllPoints, addPointRecord } from '@/api/points'
import { post, del, toastIfNotNotified } from '@/utils/request'
import type { PointRecord } from '@/api/points'
import type { UserItem } from '@/api/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showConfirm, showToast } from '@/utils/ui'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
// 增删积分需要 MANAGE_POINTS 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canManagePoints = computed(() => userStore.hasPermission('MANAGE_POINTS'))

const records = ref<PointRecord[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const showForm = ref(false)
const editing = ref<PointRecord | null>(null)
/** 正在删除的记录 id：用于按钮 loading + 防重复提交 */
const deletingId = ref<number | null>(null)

const form = ref({
  studentId: '',
  foundUser: null as UserItem | null,
  score: 0,
  reason: '',
  searching: false,
})
const formErrors = ref<Record<string, string>>({})
const submitting = ref(false)

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await getAllPoints()
    if (res.success) records.value = res.records || []
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function openForm() {
  form.value = { studentId: '', foundUser: null, score: 0, reason: '', searching: false }
  formErrors.value = {}
  showForm.value = true
}

async function searchUser() {
  const sid = form.value.studentId.trim()
  if (!sid) {
    formErrors.value = { studentId: '请输入学号' }
    return
  }
  form.value.searching = true
  form.value.foundUser = null
  formErrors.value = {}
  try {
    const res = await post('/api/auth/find-by-student', { student_id: sid })
    if (res.success && res.user) form.value.foundUser = res.user
    else formErrors.value = { studentId: '未找到该学号，请核对后重试' }
  } catch (e) {
    toastIfNotNotified(e, '查找失败，请稍后重试')
  } finally {
    form.value.searching = false
  }
}

function validateForm(): boolean {
  const errs: Record<string, string> = {}
  if (!form.value.foundUser) errs.studentId = '请先查找并确认要加减分的同学'
  else if (String(form.value.foundUser.student_id || '').trim() !== form.value.studentId.trim()) {
    // 审计修复：查找后修改学号仍会把积分记到旧用户头上
    errs.studentId = '学号已修改，请重新查找'
    form.value.foundUser = null
  }
  if (!form.value.score) errs.score = '请输入分值（正数加分，负数扣分）'
  if (!form.value.reason.trim()) errs.reason = '请填写加减分原因'
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

async function handleCreate() {
  if (submitting.value) return
  if (!validateForm() || !form.value.foundUser) return
  submitting.value = true
  try {
    await addPointRecord({
      user_id: form.value.foundUser.id,
      score: form.value.score,
      reason: form.value.reason.trim(),
    })
    showToast(`已为「${form.value.foundUser.name}」记 ${form.value.score > 0 ? '+' : ''}${form.value.score} 分`, 'success')
    showForm.value = false
    await loadData()
  } catch (e) {
    toastIfNotNotified(e, '添加失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(r: PointRecord) {
  if (deletingId.value !== null) return
  const who = r.user_name || `用户${r.user_id}`
  const ok = await showConfirm(
    '删除积分记录',
    `确认删除「${who}」的 ${r.score > 0 ? '+' : ''}${r.score} 分记录？\n原因：${r.reason || '未填写'}`,
    { danger: true, confirmText: '删除', hint: '删除后不可恢复，该同学的总分会同步变化' },
  )
  if (!ok) return
  deletingId.value = r.id
  try {
    await del(`/api/points/${r.id}`)
    showToast('已删除该积分记录', 'success')
    records.value = records.value.filter((item) => item.id !== r.id)
  } catch (e) {
    toastIfNotNotified(e, '删除失败，请稍后重试')
  } finally {
    deletingId.value = null
  }
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

    <StateView
      :loading="loading"
      :error="error"
      :empty="records.length === 0"
      empty-icon="star"
      empty-title="还没有积分记录"
      empty-description="点右下角「添加积分」给同学加分或扣分"
      :empty-action-text="canManagePoints ? '添加积分' : ''"
      @retry="loadData"
      @empty-action="openForm"
    >
      <div
        v-for="r in records"
        :key="r.id"
        class="card"
        @click="editing = editing === r ? null : r"
      >
        <div class="card-left">
          <div class="score" :class="{ positive: r.score > 0, negative: r.score < 0 }">
            {{ r.score > 0 ? '+' : '' }}{{ r.score }}
          </div>
        </div>
        <div class="card-body">
          <div class="card-title" @click.stop="goMember(r.user_id)">
            {{ r.user_name || '用户' + r.user_id }}
            <AppIcon name="chevron-right" :size="13" />
          </div>
          <div class="card-desc">{{ r.reason }}</div>
          <div class="card-meta">
            <span>{{ r.creator_name || '' }}</span>
            <span>{{ formatDate(r.created_at) }}</span>
          </div>
        </div>
        <BaseButton
          v-if="canManagePoints && editing === r"
          variant="danger"
          size="sm"
          :loading="deletingId === r.id"
          @click.stop="handleDelete(r)"
        >
          删除
        </BaseButton>
      </div>
    </StateView>

    <button v-if="canManagePoints" class="fab" type="button" @click="openForm">
      <AppIcon name="plus" :size="20" />
      <span>添加积分</span>
    </button>

    <!-- 添加积分弹窗 -->
    <BaseModal v-model="showForm" title="添加积分" :close-on-overlay="false">
      <FormField label="学号" required :error="formErrors.studentId">
        <div class="search-row">
          <input
            v-model="form.studentId"
            class="field-input"
            placeholder="输入学号"
            @keyup.enter="searchUser"
          />
          <BaseButton variant="secondary" size="md" :loading="form.searching" @click="searchUser">
            查找
          </BaseButton>
        </div>
      </FormField>

      <div v-if="form.foundUser" class="found-user">
        <AppIcon name="user" :size="18" />
        <span>{{ form.foundUser.name }}</span>
        <span class="found-sid">{{ form.foundUser.student_id }}</span>
      </div>

      <FormField label="分值（正数加分，负数扣分）" required :error="formErrors.score">
        <input v-model.number="form.score" type="number" placeholder="如 5 或 -3" />
      </FormField>

      <FormField label="原因" required :error="formErrors.reason">
        <input v-model="form.reason" placeholder="如 参加活动" maxlength="100" />
      </FormField>

      <template #footer>
        <BaseButton variant="secondary" @click="showForm = false">取消</BaseButton>
        <BaseButton :loading="submitting" @click="handleCreate">确认添加</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
/* 底部避让由 App.vue 统一处理（calc(var(--tabbar-h) + safe-area)） */
.manage-page { min-height: 100vh; background: var(--color-bg); }
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
.card-title {
  display: flex; align-items: center; gap: 2px;
  min-height: 44px;
  font-size: 14px; font-weight: 600; color: var(--color-text);
}
.card-desc { font-size: 13px; color: var(--color-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 11px; color: var(--color-text-3); margin-top: 4px; display: flex; gap: 8px; }

.fab {
  position: fixed; right: 16px; bottom: calc(var(--tabbar-h) + 16px);
  z-index: var(--z-fab);
  display: inline-flex; align-items: center; gap: 6px;
  height: 52px; padding: 0 20px;
  border: none; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-text-on-primary);
  font-size: var(--font-size-md); font-weight: 600;
  box-shadow: var(--shadow-lift); cursor: pointer;
}
.fab:active { opacity: 0.9; }

.search-row { display: flex; gap: 8px; align-items: center; }
.search-row .field-input {
  width: 100%; min-height: 44px; padding: 10px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  font-size: 14px; color: var(--color-text); background: var(--color-surface);
  outline: none; box-sizing: border-box;
}
.search-row .field-input:focus { border-color: var(--color-accent); }

.found-user {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; margin: 12px 0; border-radius: var(--radius-sm);
  background: var(--color-accent-bg); font-size: 14px; font-weight: 600; color: var(--color-accent);
}
.found-sid { font-size: 12px; color: var(--color-text-3); font-weight: 400; }
</style>
