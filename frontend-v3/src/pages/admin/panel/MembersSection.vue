<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  listMembers, getAdminClasses, createMember, updateMember, resetMemberPassword,
  setMemberStatus, deleteMember, bulkMembers, type AdminMember, type AdminClassRow
} from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import { showToast } from '@/utils/ui'

const loading = ref(false)
const members = ref<AdminMember[]>([])
const total = ref(0)
const classes = ref<AdminClassRow[]>([])
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
const busy = ref(false)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / filters.pageSize)))
const allChecked = computed(() => members.value.length > 0 && selected.value.length === members.value.length)

async function load() {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: filters.page, pageSize: filters.pageSize, member_type: filters.member_type
    }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.class_id) params.class_id = filters.class_id
    if (filters.role !== '') params.role = filters.role
    const res = await listMembers(params as any)
    members.value = res.members || []
    total.value = res.total || 0
    selected.value = []
  } catch (e: any) {
    showToast(e?.message || '加载名册失败', 'error')
  } finally {
    loading.value = false
  }
}

async function loadClasses() {
  try {
    const res = await getAdminClasses()
    if (res?.success) classes.value = res.data.classes || []
  } catch (_) { /* 忽略 */ }
}

function search() { filters.page = 1; load() }
function changePage(delta: number) {
  const next = filters.page + delta
  if (next < 1 || next > totalPages.value) return
  filters.page = next
  load()
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
  if (!editTarget.value) return
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
    showToast('已保存')
    editTarget.value = null
    await load()
  } catch (e: any) {
    showToast(e?.message || '保存失败', 'error')
  } finally {
    busy.value = false
  }
}

async function doCreate() {
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
    showToast('已创建，初始密码：' + (res.data?.defaultPassword || '123456'))
    showCreate.value = false
    createForm.name = ''
    createForm.student_id = ''
    createForm.duty_note = ''
    createForm.password = ''
    await load()
  } catch (e: any) {
    showToast(e?.message || '创建失败', 'error')
  } finally {
    busy.value = false
  }
}

async function doReset(m: AdminMember) {
  if (!confirm('重置 ' + m.name + ' 的密码为 123456？')) return
  try {
    const res = await resetMemberPassword(m.id)
    showToast('新密码：' + (res.data?.password || '123456'))
  } catch (e: any) {
    showToast(e?.message || '重置失败', 'error')
  }
}

async function doStatus(m: AdminMember, status: 'left' | 'student') {
  const word = status === 'left' ? '移出统计（历史保留）' : '恢复在队'
  if (!confirm('确认将 ' + m.name + ' ' + word + '？')) return
  try {
    await setMemberStatus(m.id, status)
    showToast('已' + word)
    await load()
  } catch (e: any) {
    showToast(e?.message || '操作失败', 'error')
  }
}

async function doDelete(m: AdminMember) {
  if (!confirm('删除 ' + m.name + '？仅当该账号没有任何历史数据时才会成功。')) return
  try {
    await deleteMember(m.id)
    showToast('已删除')
    await load()
  } catch (e: any) {
    showToast(e?.message || '删除失败', 'error')
  }
}

async function doBulk() {
  if (!selected.value.length) return
  const action = bulkAction.value
  const needsValue = action === 'set_class' || action === 'set_role' || action === 'reset_password'
  if (needsValue && bulkValue.value === '') {
    showToast('请填写批量操作的值', 'error')
    return
  }
  if (!confirm('对选中的 ' + selected.value.length + ' 人执行批量操作？')) return
  busy.value = true
  try {
    const res = await bulkMembers({
      ids: selected.value,
      action,
      value: action === 'set_role' || action === 'set_class' ? (action === 'set_role' ? Number(bulkValue.value) : bulkValue.value) : (bulkValue.value || undefined)
    })
    showToast(res.message || '批量完成')
    if (res.data?.skipped?.length) {
      showToast('有 ' + res.data.skipped.length + ' 人未处理：' + res.data.skipped[0].reason, 'error')
    }
    bulkValue.value = ''
    await load()
  } catch (e: any) {
    showToast(e?.message || '批量操作失败', 'error')
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
      <button class="btn-primary" @click="showCreate = true">+ 新增成员</button>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <input v-model="filters.keyword" placeholder="姓名 / 学号 / 手机号" @keyup.enter="search" />
      <select v-model="filters.class_id" @change="search">
        <option value="">全部区队</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <select v-model="filters.role" @change="search">
        <option value="">全部职务</option>
        <option v-for="r in ROLE_OPTIONS" :key="r" :value="r">{{ roleLabel(r) }}</option>
      </select>
      <select v-model="filters.member_type" @change="search">
        <option value="student">在队人员</option>
        <option value="left">已移出统计</option>
        <option value="all">全部账号</option>
      </select>
      <button class="btn-sm" @click="search">查询</button>
      <span class="total">共 {{ total }} 人</span>
    </div>

    <!-- 批量 -->
    <div v-if="selected.length" class="bulk-bar">
      <span>已选 {{ selected.length }} 人</span>
      <select v-model="bulkAction">
        <option value="move_out">移出统计</option>
        <option value="restore">恢复在队</option>
        <option value="set_class">调整区队</option>
        <option value="set_role">调整职务</option>
        <option value="reset_password">重置密码</option>
      </select>
      <select v-if="bulkAction === 'set_class'" v-model="bulkValue">
        <option value="">选择区队</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <select v-else-if="bulkAction === 'set_role'" v-model="bulkValue">
        <option value="">选择职务</option>
        <option v-for="r in ROLE_OPTIONS" :key="r" :value="String(r)">{{ roleLabel(r) }}</option>
      </select>
      <input v-else-if="bulkAction === 'reset_password'" v-model="bulkValue" placeholder="新密码（留空=123456）" />
      <button class="btn-sm" :disabled="busy" @click="doBulk">执行</button>
      <button class="btn-sm" @click="selected = []">取消选择</button>
    </div>

    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!members.length" class="empty">没有匹配的成员</div>
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="ck"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
            <th>姓名</th><th>学号</th><th>区队</th><th>职务</th><th>类型</th><th>请假</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td class="ck"><input type="checkbox" :checked="selected.includes(m.id)" @change="toggleOne(m.id)" /></td>
            <td>{{ m.name }}</td>
            <td class="mono">{{ m.student_id }}</td>
            <td>{{ m.class_name || m.class_id }}</td>
            <td>
              <span class="role-tag" :class="{ cadre: m.role > 0 }">{{ roleLabel(m.role) }}</span>
              <span v-if="m.duty_note" class="duty-tag">{{ m.duty_note }}</span>
            </td>
            <td>
              <span class="type-tag" :class="m.member_type === 'left' ? 'left' : ''">
                {{ m.member_type === 'left' ? '已移出' : m.member_type === 'system' ? '系统' : m.member_type === 'staff' ? '教职工' : '在队' }}
              </span>
            </td>
            <td>{{ m.active_leave_count ? m.active_leave_count + ' 条' : '—' }}</td>
            <td class="ops">
              <button class="btn-xs" @click="openEdit(m)">编辑</button>
              <button class="btn-xs" @click="doReset(m)">重置密码</button>
              <button v-if="m.member_type !== 'left'" class="btn-xs" @click="doStatus(m, 'left')">移出</button>
              <button v-else class="btn-xs" @click="doStatus(m, 'student')">恢复</button>
              <button class="btn-xs danger" @click="doDelete(m)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button class="btn-sm" :disabled="filters.page <= 1" @click="changePage(-1)">上一页</button>
      <span>第 {{ filters.page }} / {{ totalPages }} 页</span>
      <button class="btn-sm" :disabled="filters.page >= totalPages" @click="changePage(1)">下一页</button>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editTarget" class="mask" @click.self="editTarget = null">
      <div class="modal">
        <h3>编辑成员 · {{ editTarget.name }}</h3>
        <label>姓名<input v-model="editForm.name" /></label>
        <label>学号<input v-model="editForm.student_id" /></label>
        <label>区队
          <select v-model="editForm.class_id">
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>职务
          <select v-model="editForm.role">
            <option v-for="r in ROLE_OPTIONS" :key="r" :value="r">{{ roleLabel(r) }}</option>
          </select>
        </label>
        <label>职务备注<input v-model="editForm.duty_note" placeholder="如：临时学副 / 协助生副" /></label>
        <label>人员类型
          <select v-model="editForm.member_type">
            <option value="student">在队学员</option>
            <option value="staff">教职工</option>
            <option value="system">系统账号</option>
            <option value="left">已移出统计</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="btn-sm" @click="editTarget = null">取消</button>
          <button class="btn-primary" :disabled="busy" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>

    <!-- 新增弹窗 -->
    <div v-if="showCreate" class="mask" @click.self="showCreate = false">
      <div class="modal">
        <h3>新增成员</h3>
        <label>姓名<input v-model="createForm.name" /></label>
        <label>学号<input v-model="createForm.student_id" /></label>
        <label>区队
          <select v-model="createForm.class_id">
            <option value="">未分配</option>
            <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>职务
          <select v-model="createForm.role">
            <option v-for="r in ROLE_OPTIONS" :key="r" :value="r">{{ roleLabel(r) }}</option>
          </select>
        </label>
        <label>职务备注<input v-model="createForm.duty_note" /></label>
        <label>初始密码<input v-model="createForm.password" placeholder="留空则使用 123456" /></label>
        <div class="modal-actions">
          <button class="btn-sm" @click="showCreate = false">取消</button>
          <button class="btn-primary" :disabled="busy" @click="doCreate">创建</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; }
h2 { font-size: 18px; margin: 0 0 12px; color: var(--color-text); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.filters input, .filters select, .modal input, .modal select {
  height: 34px; padding: 0 10px; font-size: 13px; border: 1px solid var(--color-border);
  border-radius: 8px; background: var(--color-surface); color: var(--color-text);
}
.total { font-size: 12px; color: var(--color-text-3); }
.bulk-bar {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 10px; margin-bottom: 10px;
  background: var(--color-accent-bg); border-radius: var(--radius-md, 12px); font-size: 13px; color: var(--color-text-2);
}
.bulk-bar select, .bulk-bar input { height: 30px; padding: 0 8px; font-size: 13px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { border-bottom: 1px solid var(--color-border); padding: 8px 10px; text-align: left; color: var(--color-text-2); white-space: nowrap; }
.data-table th { color: var(--color-text-3); font-size: 12px; }
.ck { width: 32px; }
.mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
.role-tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--color-surface-hover); color: var(--color-text-3); }
.role-tag.cadre { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }
.duty-tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; margin-left: 4px; background: var(--color-accent-bg); color: var(--color-accent); }
.type-tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: rgba(46,160,67,.12); color: #2ea043; }
.type-tag.left { background: var(--color-surface-hover); color: var(--color-text-3); }
.ops { display: flex; gap: 4px; }
.pager { display: flex; align-items: center; gap: 10px; margin-top: 12px; font-size: 13px; color: var(--color-text-3); }
.loading, .empty { color: var(--color-text-3); font-size: 13px; padding: 12px 0; }
.btn-sm, .btn-primary, .btn-xs {
  cursor: pointer; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-2); border-radius: 8px;
}
.btn-sm { font-size: 12px; padding: 5px 10px; }
.btn-xs { font-size: 11px; padding: 3px 7px; border-radius: 6px; }
.btn-xs.danger { color: #e5484d; border-color: rgba(229,72,77,.4); }
.btn-primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-size: 13px; padding: 7px 14px; border-radius: 8px; }
.btn-primary:disabled { opacity: .6; }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
.modal {
  width: 100%; max-width: 420px; background: var(--color-surface); border-radius: var(--radius-md, 12px);
  padding: 18px; display: flex; flex-direction: column; gap: 10px; max-height: 90vh; overflow-y: auto;
}
.modal h3 { margin: 0 0 4px; font-size: 16px; color: var(--color-text); }
.modal label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--color-text-3); }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
</style>
