<script setup lang="ts">
/**
 * 成员管理
 *
 * 2026-09 修复：
 *  - 错误态：加载失败不再只弹 toast（列表随后显示「没有匹配的成员」，把失败当业务事实），
 *    error 交给 StateView 渲染 + 重试
 *  - 竞态：翻页/筛选/搜索用自增 reqId，只接受最新一次响应（此前快速翻页会串页）
 *  - 破坏性操作：移出 / 恢复 / 删除 / 重置密码 / 批量操作全部走 showConfirm，
 *    文案含「对象 + 动作 + 后果」，确认按钮 danger，执行中防重
 *  - 弹窗改用 BaseModal + FormField；按钮改用 BaseButton；色值改用令牌
 */
import { computed, onMounted, reactive, ref } from 'vue'
import {
  listMembers, getAdminClasses, createMember, updateMember, resetMemberPassword,
  setMemberStatus, deleteMember, bulkMembers, type AdminMember, type AdminClassRow
} from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import FormField from '@/components/ui/FormField.vue'

const loading = ref(false)
/** 错误对象：有值即渲染错误态 + 重试 */
const error = ref<unknown>(null)
const members = ref<AdminMember[]>([])
const total = ref(0)
const classes = ref<AdminClassRow[]>([])
/** 区队下拉（辅助筛选项）加载失败：降级为不显示，但仍给出可重试的提示 */
const classesError = ref(false)
const selected = ref<number[]>([])

const filters = reactive({
  keyword: '',
  class_id: '',
  role: '' as '' | number,
  member_type: 'student' as 'student' | 'left' | 'all',
  page: 1,
  pageSize: 50
})

const ROLE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const roleLabel = (r: number) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] || ('角色' + r)

// ---- 弹窗状态 ----
const editTarget = ref<AdminMember | null>(null)
const editForm = reactive({ name: '', student_id: '', class_id: '', role: 0, duty_note: '', member_type: 'student' })
const showCreate = ref(false)
const createForm = reactive({ name: '', student_id: '', class_id: '', role: 0, duty_note: '', password: '' })
const bulkAction = ref<'move_out' | 'restore' | 'set_class' | 'set_role' | 'reset_password'>('move_out')
const bulkValue = ref('')
/** 弹窗 / 批量提交中 */
const busy = ref(false)
/** 行内破坏性操作中的成员 id */
const rowBusy = ref<number | null>(null)
const anyBusy = computed(() => busy.value || rowBusy.value !== null)

/** 竞态守卫：只接受最新一次列表响应 */
let reqSeq = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / filters.pageSize)))
const allChecked = computed(() => members.value.length > 0 && selected.value.length === members.value.length)
const hasFilter = computed(
  () => !!filters.keyword.trim() || !!filters.class_id || filters.role !== '' || filters.member_type !== 'student'
)

async function load() {
  const seq = ++reqSeq
  loading.value = true
  error.value = null
  try {
    const params: Record<string, unknown> = {
      page: filters.page, pageSize: filters.pageSize, member_type: filters.member_type
    }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.class_id) params.class_id = filters.class_id
    if (filters.role !== '') params.role = filters.role
    const res = await listMembers(params as any)
    if (seq !== reqSeq) return
    members.value = res.members || []
    total.value = res.total || 0
    selected.value = []
  } catch (e) {
    if (seq !== reqSeq) return
    members.value = []
    total.value = 0
    error.value = e
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

async function loadClasses() {
  // 区队下拉为筛选辅助项：失败时降级为「不显示该筛选项」，不影响名册主流程
  classesError.value = false
  try {
    const res = await getAdminClasses()
    if (res?.success) classes.value = res.data.classes || []
    else classesError.value = true
  } catch {
    classes.value = []
    classesError.value = true
  }
}

function search() { filters.page = 1; void load() }

/** 空态 CTA：一键回到默认筛选（在队人员 + 无关键词） */
function clearFilters() {
  filters.keyword = ''
  filters.class_id = ''
  filters.role = ''
  filters.member_type = 'student'
  search()
}
function changePage(delta: number) {
  if (loading.value) return
  const next = filters.page + delta
  if (next < 1 || next > totalPages.value) return
  filters.page = next
  void load()
}

function toggleAll() {
  selected.value = allChecked.value ? [] : members.value.map((m) => m.id)
}
function toggleOne(id: number) {
  const i = selected.value.indexOf(id)
  if (i > -1) selected.value.splice(i, 1)
  else selected.value.push(id)
}

function openEdit(m: AdminMember) {
  editTarget.value = m
  editForm.name = m.name
  editForm.student_id = m.student_id
  editForm.class_id = String(m.class_id || '')
  editForm.role = Number(m.role) || 0
  editForm.duty_note = m.duty_note || ''
  editForm.member_type = m.member_type || 'student'
}

async function saveEdit() {
  if (!editTarget.value || busy.value) return
  busy.value = true
  try {
    await updateMember(editTarget.value.id, {
      name: editForm.name,
      student_id: editForm.student_id,
      class_id: editForm.class_id,
      role: editForm.role,
      duty_note: editForm.duty_note || null,
      member_type: editForm.member_type
    })
    showToast('已保存', 'success')
    editTarget.value = null
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '保存失败，请稍后重试')
  } finally {
    busy.value = false
  }
}

async function doCreate() {
  if (busy.value) return
  busy.value = true
  try {
    const res = await createMember({
      name: createForm.name,
      student_id: createForm.student_id,
      class_id: createForm.class_id || undefined,
      role: createForm.role,
      duty_note: createForm.duty_note || null,
      password: createForm.password || undefined
    })
    showToast('已创建，初始密码：' + (res.data?.defaultPassword || '123456'), 'success')
    showCreate.value = false
    createForm.name = ''
    createForm.student_id = ''
    createForm.duty_note = ''
    createForm.password = ''
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '创建失败，请稍后重试')
  } finally {
    busy.value = false
  }
}

async function doReset(m: AdminMember) {
  if (anyBusy.value) return
  const ok = await showConfirm(
    '重置登录密码',
    `确定重置「${m.name}」（学号 ${m.student_id}）的登录密码？`,
    {
      confirmText: '重置密码',
      danger: true,
      hint: '重置后原密码立即失效，该用户需用初始密码 123456 重新登录（请提醒本人登录后尽快修改）。'
    }
  )
  if (!ok) return
  rowBusy.value = m.id
  try {
    const res = await resetMemberPassword(m.id)
    showToast('新密码：' + (res.data?.password || '123456'), 'success')
  } catch (e: any) {
    toastIfNotNotified(e, '重置失败，请稍后重试')
  } finally {
    rowBusy.value = null
  }
}

async function doStatus(m: AdminMember, status: 'left' | 'student') {
  if (anyBusy.value) return
  const toLeft = status === 'left'
  const ok = await showConfirm(
    toLeft ? '移出统计' : '恢复在队',
    toLeft
      ? `确定将「${m.name}」（学号 ${m.student_id}）移出统计？`
      : `确定将「${m.name}」（学号 ${m.student_id}）恢复为在队？`,
    {
      confirmText: toLeft ? '移出统计' : '恢复在队',
      danger: toLeft,
      hint: toLeft
        ? '移出后不计入在队人数，并会同时清空该成员的职务与职务备注；恢复在队时不会还原这些内容（历史数据保留）。'
        : '恢复后该成员重新计入在队人数；职务与职务备注需要重新设置。'
    }
  )
  if (!ok) return
  rowBusy.value = m.id
  try {
    await setMemberStatus(m.id, status)
    showToast(toLeft ? '已移出统计' : '已恢复在队', 'success')
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '操作失败，请稍后重试')
  } finally {
    rowBusy.value = null
  }
}

async function doDelete(m: AdminMember) {
  if (anyBusy.value) return
  const ok = await showConfirm(
    '删除成员账号',
    `确定删除「${m.name}」（学号 ${m.student_id}）？`,
    {
      confirmText: '删除账号',
      danger: true,
      hint: '仅当该账号没有任何请假/报销等历史数据时才会删除成功；删除后账号无法恢复，如需保留历史请改用「移出统计」。'
    }
  )
  if (!ok) return
  rowBusy.value = m.id
  try {
    await deleteMember(m.id)
    showToast('已删除', 'success')
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '删除失败，请稍后重试')
  } finally {
    rowBusy.value = null
  }
}

const BULK_LABELS: Record<string, string> = {
  move_out: '移出统计',
  restore: '恢复在队',
  set_class: '调整区队',
  set_role: '调整职务',
  reset_password: '重置密码'
}

/** 批量操作的值展示（区队名 / 职务名 / 密码） */
function bulkValueLabel(): string {
  const action = bulkAction.value
  if (action === 'set_class') {
    return classes.value.find((c) => c.id === bulkValue.value)?.name || bulkValue.value
  }
  if (action === 'set_role') return roleLabel(Number(bulkValue.value))
  if (action === 'reset_password') return bulkValue.value || '123456'
  return ''
}

async function doBulk() {
  if (!selected.value.length || busy.value) return
  const action = bulkAction.value
  const needsValue = action === 'set_class' || action === 'set_role' || action === 'reset_password'
  if (needsValue && bulkValue.value === '') {
    showToast('请先选择或填写批量操作的值', 'error')
    return
  }
  const count = selected.value.length
  const label = BULK_LABELS[action] || action
  const target = needsValue ? `（目标值：${bulkValueLabel()}）` : ''
  const HINTS: Record<string, string> = {
    move_out: '移出后不计入在队人数，并会清空这些成员的职务与职务备注，恢复时不还原（历史数据保留）。',
    restore: '恢复后这些成员重新计入在队人数；职务与职务备注需要重新设置。',
    set_class: '调整后这些成员的名册归属立即变更，原区队的统计随之减少。',
    set_role: '职务变更立即生效，权限也会随之变化（例如设为区队长后可审批请假）。',
    reset_password: '重置后这些成员的原密码立即失效，需用新密码重新登录；请提醒本人尽快修改。'
  }
  const ok = await showConfirm(
    `批量${label}`,
    `对选中的 ${count} 名成员执行「${label}」？${target}`,
    { confirmText: `执行${label}`, danger: true, hint: HINTS[action] || '操作立即生效，请确认对象无误。' }
  )
  if (!ok) return
  busy.value = true
  try {
    const res = await bulkMembers({
      ids: selected.value,
      action,
      value: action === 'set_role' || action === 'set_class' ? (action === 'set_role' ? Number(bulkValue.value) : bulkValue.value) : (bulkValue.value || undefined)
    })
    showToast(res.message || `已完成 ${count} 名成员的「${label}」`, 'success')
    if (res.data?.skipped?.length) {
      showToast('有 ' + res.data.skipped.length + ' 人未处理：' + res.data.skipped[0].reason, 'error')
    }
    bulkValue.value = ''
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '批量操作失败，请稍后重试')
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await loadClasses()
  await load()
})
defineExpose({ reload: load })
</script>

<template>
  <section>
    <div class="sec-head">
      <h2>成员管理</h2>
      <BaseButton size="sm" @click="showCreate = true">新增成员</BaseButton>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <input v-model="filters.keyword" placeholder="姓名 / 学号 / 手机号" @keyup.enter="search" />
      <select v-model="filters.class_id" :disabled="loading" @change="search">
        <option value="">全部区队</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <select v-model="filters.role" :disabled="loading" @change="search">
        <option value="">全部职务</option>
        <option v-for="r in ROLE_OPTIONS" :key="r" :value="r">{{ roleLabel(r) }}</option>
      </select>
      <select v-model="filters.member_type" :disabled="loading" @change="search">
        <option value="student">在队人员</option>
        <option value="left">已移出统计</option>
        <option value="all">全部账号</option>
      </select>
      <BaseButton variant="secondary" size="sm" :loading="loading" @click="search">查询</BaseButton>
      <span class="total">共 {{ total }} 人</span>
    </div>

    <div v-if="classesError" class="inline-warn">
      <AppIcon name="alert-triangle" :size="14" />
      <span>区队列表加载失败（「全部区队」筛选不可用，其它功能不受影响）</span>
      <BaseButton variant="text" size="sm" @click="loadClasses">重试</BaseButton>
    </div>

    <!-- 批量 -->
    <div v-if="selected.length" class="bulk-bar">
      <span class="bulk-count">已选 {{ selected.length }} 人</span>
      <select v-model="bulkAction" :disabled="busy">
        <option value="move_out">移出统计</option>
        <option value="restore">恢复在队</option>
        <option value="set_class">调整区队</option>
        <option value="set_role">调整职务</option>
        <option value="reset_password">重置密码</option>
      </select>
      <select v-if="bulkAction === 'set_class'" v-model="bulkValue" :disabled="busy">
        <option value="">选择区队</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <select v-else-if="bulkAction === 'set_role'" v-model="bulkValue" :disabled="busy">
        <option value="">选择职务</option>
        <option v-for="r in ROLE_OPTIONS" :key="r" :value="String(r)">{{ roleLabel(r) }}</option>
      </select>
      <input v-else-if="bulkAction === 'reset_password'" v-model="bulkValue" :disabled="busy" placeholder="新密码（留空=123456）" />
      <BaseButton variant="danger" size="sm" :loading="busy" @click="doBulk">执行</BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="busy" @click="selected = []">取消选择</BaseButton>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="members.length === 0"
      loading-text="正在加载名册…"
      @retry="load"
    >
      <template #empty>
        <EmptyState
          :icon="hasFilter ? 'search' : 'users'"
          :variant="hasFilter ? 'filtered' : 'default'"
          :title="hasFilter ? '没有匹配的成员' : '名册里还没有成员'"
          :description="
            hasFilter
              ? '试试放宽筛选条件（例如切换到「全部账号」），或清空关键词后重新查询。'
              : '可以点「新增成员」逐个添加，或用「名册导入」批量导入 .xlsx 花名册。'
          "
          :action-text="hasFilter ? '清空筛选条件' : '新增成员'"
          @action="hasFilter ? clearFilters() : (showCreate = true)"
        />
      </template>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="ck"><input type="checkbox" :checked="allChecked" :disabled="anyBusy" @change="toggleAll" /></th>
              <th>姓名</th><th>学号</th><th>区队</th><th>职务</th><th>类型</th><th>请假</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td class="ck">
                <input type="checkbox" :checked="selected.includes(m.id)" :disabled="anyBusy" @change="toggleOne(m.id)" />
              </td>
              <td class="cell-name" data-label="姓名">
                <span class="name">{{ m.name }}</span>
                <span class="sub-line">学号 {{ m.student_id }}</span>
              </td>
              <td class="mono col-student" data-label="学号">{{ m.student_id }}</td>
              <td data-label="区队">{{ m.class_name || m.class_id || '—' }}</td>
              <td data-label="职务">
                <span class="role-tag" :class="{ cadre: m.role > 0 }">{{ roleLabel(m.role) }}</span>
                <span v-if="m.duty_note" class="duty-tag">{{ m.duty_note }}</span>
              </td>
              <td data-label="类型">
                <BaseBadge :variant="m.member_type === 'left' ? 'default' : 'success'">
                  {{ m.member_type === 'left' ? '已移出' : m.member_type === 'system' ? '系统' : m.member_type === 'staff' ? '教职工' : '在队' }}
                </BaseBadge>
              </td>
              <td data-label="请假">{{ m.active_leave_count ? m.active_leave_count + ' 条' : '—' }}</td>
              <td class="ops" data-label="操作">
                <BaseButton variant="ghost" size="sm" :disabled="anyBusy" @click="openEdit(m)">编辑</BaseButton>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  :loading="rowBusy === m.id"
                  :disabled="anyBusy && rowBusy !== m.id"
                  @click="doReset(m)"
                >
                  重置密码
                </BaseButton>
                <BaseButton
                  v-if="m.member_type !== 'left'"
                  variant="ghost"
                  size="sm"
                  :disabled="anyBusy"
                  @click="doStatus(m, 'left')"
                >
                  移出
                </BaseButton>
                <BaseButton v-else variant="ghost" size="sm" :disabled="anyBusy" @click="doStatus(m, 'student')">
                  恢复
                </BaseButton>
                <BaseButton variant="danger" size="sm" :disabled="anyBusy" @click="doDelete(m)">删除</BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager">
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="loading || filters.page <= 1"
          @click="changePage(-1)"
        >
          上一页
        </BaseButton>
        <span>第 {{ filters.page }} / {{ totalPages }} 页</span>
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="loading || filters.page >= totalPages"
          @click="changePage(1)"
        >
          下一页
        </BaseButton>
      </div>
    </StateView>

    <!-- 编辑弹窗 -->
    <BaseModal :model-value="!!editTarget" :title="`编辑成员 · ${editTarget?.name || ''}`" @update:model-value="editTarget = null">
      <FormField label="姓名"><input v-model="editForm.name" /></FormField>
      <FormField label="学号"><input v-model="editForm.student_id" /></FormField>
      <FormField label="区队">
        <select v-model="editForm.class_id">
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </FormField>
      <FormField label="职务">
        <select v-model="editForm.role">
          <option v-for="r in ROLE_OPTIONS" :key="r" :value="r">{{ roleLabel(r) }}</option>
        </select>
      </FormField>
      <FormField label="职务备注" hint="如：临时学副 / 协助生副">
        <input v-model="editForm.duty_note" />
      </FormField>
      <FormField label="人员类型">
        <select v-model="editForm.member_type">
          <option value="student">在队学员</option>
          <option value="staff">教职工</option>
          <option value="system">系统账号</option>
          <option value="left">已移出统计</option>
        </select>
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" :disabled="busy" @click="editTarget = null">取消</BaseButton>
        <BaseButton :loading="busy" @click="saveEdit">保存</BaseButton>
      </template>
    </BaseModal>

    <!-- 新增弹窗 -->
    <BaseModal v-model="showCreate" title="新增成员">
      <FormField label="姓名"><input v-model="createForm.name" /></FormField>
      <FormField label="学号"><input v-model="createForm.student_id" /></FormField>
      <FormField label="区队">
        <select v-model="createForm.class_id">
          <option value="">未分配</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </FormField>
      <FormField label="职务">
        <select v-model="createForm.role">
          <option v-for="r in ROLE_OPTIONS" :key="r" :value="r">{{ roleLabel(r) }}</option>
        </select>
      </FormField>
      <FormField label="职务备注"><input v-model="createForm.duty_note" /></FormField>
      <FormField label="初始密码" hint="留空则使用 123456">
        <input v-model="createForm.password" />
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" :disabled="busy" @click="showCreate = false">取消</BaseButton>
        <BaseButton :loading="busy" @click="doCreate">创建</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
h2 { font-size: var(--font-size-lg); margin: 0 0 12px; color: var(--color-text); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.filters input, .filters select {
  height: 34px; padding: 0 10px; font-size: var(--font-size-sm); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
}
.total { font-size: var(--font-size-xs); color: var(--color-text-3); }
.inline-warn {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin: 0 0 10px; font-size: var(--font-size-xs); color: var(--color-warning);
}
.bulk-bar {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 10px; margin-bottom: 10px;
  background: var(--color-accent-bg); border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--color-text-2);
}
.bulk-count { font-weight: 600; color: var(--color-accent); }
.bulk-bar select, .bulk-bar input {
  height: 32px; padding: 0 8px; font-size: var(--font-size-sm); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
}
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.data-table th, .data-table td {
  border-bottom: 1px solid var(--color-border); padding: 8px 10px; text-align: left;
  color: var(--color-text-2); white-space: nowrap; vertical-align: middle;
}
.data-table th { color: var(--color-text-3); font-size: var(--font-size-xs); }
.ck { width: 32px; }
.ck input { width: 16px; height: 16px; accent-color: var(--color-accent); }
.mono { font-family: ui-monospace, Menlo, monospace; font-size: var(--font-size-xs); }
.sub-line { display: none; font-size: var(--font-size-2xs); color: var(--color-text-3); }
.role-tag { font-size: var(--font-size-2xs); padding: 1px 6px; border-radius: 4px; background: var(--color-surface-hover); color: var(--color-text-3); }
.role-tag.cadre { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }
.duty-tag { font-size: var(--font-size-2xs); padding: 1px 6px; border-radius: 4px; margin-left: 4px; background: var(--color-accent-bg); color: var(--color-accent); }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.pager { display: flex; align-items: center; gap: 10px; margin-top: 12px; font-size: var(--font-size-sm); color: var(--color-text-3); }

/* ========== Responsive ========== */
@media (max-width: 768px) {
  .filters { display: grid; grid-template-columns: 1fr 1fr; }
  .filters input { grid-column: 1 / -1; }
  .filters :deep(.btn) { width: 100%; }
  .filters .total { grid-column: 1 / -1; }
  .bulk-bar :deep(.btn) { width: 100%; }
}

/* 窄屏：表格转卡片，学号折进姓名下方，操作按钮换行显示 */
@media (max-width: 640px) {
  .table-wrap { overflow-x: visible; }
  .data-table, .data-table tbody, .data-table tr, .data-table td { display: block; width: 100%; }
  .data-table thead { display: none; }
  .data-table tbody tr {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    margin-bottom: 10px;
    box-shadow: var(--shadow-card);
  }
  .data-table td {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    border-bottom: none; padding: 3px 0; white-space: normal;
  }
  .data-table td::before {
    content: attr(data-label);
    flex: 0 0 auto;
    color: var(--color-text-3);
    font-size: var(--font-size-xs);
  }
  .data-table td.ck { justify-content: flex-start; }
  .data-table td.ck::before { content: '选择'; }
  .col-student { display: none !important; }
  .cell-name { justify-content: flex-start !important; }
  .cell-name::before { content: none !important; }
  .sub-line { display: block; margin-left: 6px; }
  .ops { justify-content: flex-end; flex-wrap: wrap; }
}
</style>
