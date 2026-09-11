<script setup lang="ts">
/**
 * 中队与区队管理
 *
 * 2026-09 修复：
 *  - 加载失败不再只弹 toast（页面随后是完全空白的「暂无中队数据」），
 *    error 交给 StateView 渲染 + 重试
 *  - 按钮 → BaseButton；空态 → EmptyState；窄屏隐藏次要列
 */
import { computed, onMounted, ref } from 'vue'
import {
  createAdminClass,
  getAdminClasses,
  updateAdminClass,
  updateCompany,
} from '@/api/admin'
import type { AdminClassRow } from '@/api/admin'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const classes = ref<AdminClassRow[]>([])
const companies = ref<{ id: string; name: string }[]>([])
const leaders = ref<{ class_id: string; name: string }[]>([])
const loading = ref(true)
/** 错误对象：有值即渲染错误态 + 重试 */
const error = ref<unknown>(null)

/* 中队重命名 */
const editingCompanyId = ref<string | null>(null)
const companyDraft = ref('')
const savingCompanyId = ref<string | null>(null)

/* 区队重命名 */
const editingClassId = ref<string | null>(null)
const classDraft = ref('')
const savingClassId = ref<string | null>(null)

/* 新建区队 */
const newId = ref('')
const newName = ref('')
const newCompanyId = ref('')
const creating = ref(false)

/** 区队 → 区队长姓名（一个区队可能有多名，用顿号连接） */
const leadersByClass = computed<Record<string, string>>(() => {
  const map: Record<string, string[]> = {}
  for (const l of leaders.value) {
    if (!l || !l.class_id) continue
    if (!map[l.class_id]) map[l.class_id] = []
    if (l.name) map[l.class_id].push(l.name)
  }
  const out: Record<string, string> = {}
  for (const [cid, names] of Object.entries(map)) out[cid] = names.join('、')
  return out
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getAdminClasses()
    classes.value = res?.data?.classes || []
    companies.value = res?.data?.companies || []
    leaders.value = res?.data?.leaders || []
  } catch (e: any) {
    classes.value = []
    companies.value = []
    leaders.value = []
    error.value = e
    toastIfNotNotified(e, '加载中队与区队数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function leaderName(classId: string): string {
  return leadersByClass.value[classId] || '—'
}

/* ===== 中队重命名 ===== */
function startCompanyEdit(c: { id: string; name: string }) {
  editingCompanyId.value = c.id
  companyDraft.value = c.name
}

function cancelCompanyEdit() {
  editingCompanyId.value = null
  companyDraft.value = ''
}

async function saveCompany(c: { id: string; name: string }) {
  if (savingCompanyId.value) return
  const name = companyDraft.value.trim()
  if (!name) {
    showToast('中队名称不能为空', 'error')
    return
  }
  if (name === c.name) {
    cancelCompanyEdit()
    return
  }
  savingCompanyId.value = c.id
  try {
    await updateCompany(c.id, name)
    cancelCompanyEdit()
    showToast('中队名称已更新', 'success')
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '中队重命名失败')
  } finally {
    savingCompanyId.value = null
  }
}

/* ===== 区队重命名 ===== */
function startClassEdit(row: AdminClassRow) {
  editingClassId.value = row.id
  classDraft.value = row.name
}

function cancelClassEdit() {
  editingClassId.value = null
  classDraft.value = ''
}

async function saveClass(row: AdminClassRow) {
  if (savingClassId.value) return
  const name = classDraft.value.trim()
  if (!name) {
    showToast('区队名称不能为空', 'error')
    return
  }
  if (name === row.name) {
    cancelClassEdit()
    return
  }
  savingClassId.value = row.id
  try {
    await updateAdminClass(row.id, { name })
    cancelClassEdit()
    showToast('区队名称已更新', 'success')
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '区队重命名失败')
  } finally {
    savingClassId.value = null
  }
}

/* ===== 新建区队 ===== */
async function handleCreate() {
  if (creating.value) return
  const id = newId.value.trim()
  const name = newName.value.trim()
  if (!id) {
    showToast('请填写区队编号', 'error')
    return
  }
  if (!name) {
    showToast('请填写区队名称', 'error')
    return
  }
  creating.value = true
  try {
    await createAdminClass({
      id,
      name,
      company_id: newCompanyId.value || undefined,
    })
    showToast('区队创建成功', 'success')
    newId.value = ''
    newName.value = ''
    newCompanyId.value = ''
    await load()
  } catch (e: any) {
    toastIfNotNotified(e, '新建区队失败')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <section>
    <h2>中队与区队管理</h2>

    <StateView :loading="loading" :error="error" loading-text="正在加载中队与区队…" @retry="load">
      <!-- 中队 -->
      <div class="section-label">中队</div>
      <div class="company-cards">
        <EmptyState
          v-if="companies.length === 0"
          icon="building"
          title="还没有中队"
          description="中队由后台数据初始化；如需新增，请先在服务端配置 company 数据。"
        />
        <div v-for="c in companies" :key="c.id" class="company-card">
          <template v-if="editingCompanyId === c.id">
            <input
              v-model="companyDraft"
              class="inline-input"
              placeholder="中队名称"
              @keyup.enter="saveCompany(c)"
            />
            <div class="company-actions">
              <BaseButton size="sm" :loading="savingCompanyId === c.id" @click="saveCompany(c)">保存</BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="savingCompanyId === c.id" @click="cancelCompanyEdit">
                取消
              </BaseButton>
            </div>
          </template>
          <template v-else>
            <div class="company-main">
              <span class="company-name">{{ c.name }}</span>
              <span class="company-id">编号 {{ c.id }}</span>
            </div>
            <BaseButton variant="ghost" size="sm" @click="startCompanyEdit(c)">重命名</BaseButton>
          </template>
        </div>
      </div>

      <!-- 区队 -->
      <div class="section-label">区队</div>
      <EmptyState
        v-if="classes.length === 0"
        icon="building"
        title="还没有区队"
        description="可在下方「新建区队」里填写编号与名称创建；区队创建后即可在成员管理里分配学员。"
      />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>名称</th>
              <th>所属中队</th>
              <th>在队人数</th>
              <th class="col-optional">干部数</th>
              <th class="col-optional">已离开数</th>
              <th>区队长</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in classes" :key="row.id">
              <td class="col-id" data-label="编号">{{ row.id }}</td>
              <td class="col-name" data-label="名称">
                <input
                  v-if="editingClassId === row.id"
                  v-model="classDraft"
                  class="inline-input"
                  placeholder="区队名称"
                  @keyup.enter="saveClass(row)"
                />
                <span v-else>{{ row.name }}</span>
              </td>
              <td data-label="所属中队">{{ row.company_name || row.company_id || '—' }}</td>
              <td data-label="在队人数">{{ row.students }}</td>
              <td class="col-optional" data-label="干部数">{{ row.cadres }}</td>
              <td class="col-optional" data-label="已离开数">{{ row.lefts }}</td>
              <td data-label="区队长">{{ leaderName(row.id) }}</td>
              <td class="col-actions" data-label="操作">
                <template v-if="editingClassId === row.id">
                  <BaseButton size="sm" :loading="savingClassId === row.id" @click="saveClass(row)">保存</BaseButton>
                  <BaseButton variant="ghost" size="sm" :disabled="savingClassId === row.id" @click="cancelClassEdit">
                    取消
                  </BaseButton>
                </template>
                <BaseButton v-else variant="ghost" size="sm" @click="startClassEdit(row)">重命名</BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 新建区队 -->
      <div class="section-label">新建区队</div>
      <div class="create-card">
        <div class="create-field">
          <label class="field-label">编号</label>
          <input v-model="newId" class="text-input" placeholder="如 7" />
        </div>
        <div class="create-field">
          <label class="field-label">名称</label>
          <input v-model="newName" class="text-input" placeholder="如 数据警务技术七区队" />
        </div>
        <div class="create-field">
          <label class="field-label">所属中队</label>
          <select v-model="newCompanyId" class="text-input">
            <option value="">未指定</option>
            <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <BaseButton class="create-btn" :loading="creating" @click="handleCreate">新建区队</BaseButton>
      </div>
    </StateView>
  </section>
</template>

<style scoped>
h2 {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px;
}

.section-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px;
}

/* ========== 中队卡 ========== */
.company-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}
.company-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.company-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.company-name { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); }
.company-id { font-size: var(--font-size-2xs); color: var(--color-text-3); }
.company-actions { display: flex; gap: 6px; }

/* ========== 表格 ========== */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px; }
.data-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.data-table th,
.data-table td {
  text-align: left;
  padding: 8px 10px;
  font-size: var(--font-size-sm);
  border-bottom: 1px solid var(--color-border);
}
.data-table th {
  background: var(--color-surface-hover);
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}
.data-table td { color: var(--color-text); }
.data-table tbody tr:hover { background: var(--color-surface-hover); }
.col-id { color: var(--color-text-2); font-variant-numeric: tabular-nums; }
.col-name { min-width: 180px; }
.col-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

/* ========== 新建表单 ========== */
.create-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}
.create-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
.field-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-2); }
.text-input,
.inline-input {
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0 10px;
  font-size: var(--font-size-sm);
  background: var(--color-surface);
  color: var(--color-text);
  box-sizing: border-box;
}
.inline-input { width: 100%; min-width: 120px; }
.create-btn { height: 38px; }

/* ========== 响应式 ========== */
@media (max-width: 768px) {
  h2 { font-size: var(--font-size-lg); margin-bottom: 12px; }
  .company-cards { grid-template-columns: 1fr; }
  .create-field { min-width: 100%; }
  .create-btn { width: 100%; }
}

/* 窄屏：隐藏次要统计列，表格不再横向滚动 */
@media (max-width: 640px) {
  .table-wrap { overflow-x: visible; }
  .data-table { min-width: 0; font-size: var(--font-size-xs); }
  .data-table .col-optional { display: none; }
  .data-table th, .data-table td { padding: 8px 6px; }
  .col-name { min-width: 0; }
}
</style>
