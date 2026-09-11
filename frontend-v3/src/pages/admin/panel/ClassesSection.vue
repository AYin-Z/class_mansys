<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  createAdminClass,
  getAdminClasses,
  updateAdminClass,
  updateCompany,
} from '@/api/admin'
import type { AdminClassRow } from '@/api/admin'
import { showToast } from '@/utils/ui'

const classes = ref<AdminClassRow[]>([])
const companies = ref<{ id: string; name: string }[]>([])
const leaders = ref<{ class_id: string; name: string }[]>([])
const loading = ref(true)

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
  try {
    const res = await getAdminClasses()
    classes.value = res?.data?.classes || []
    companies.value = res?.data?.companies || []
    leaders.value = res?.data?.leaders || []
  } catch (e: any) {
    classes.value = []
    companies.value = []
    leaders.value = []
    showToast(e?.message || '加载中队与区队数据失败', 'error')
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
    showToast('中队名称已更新')
    await load()
  } catch (e: any) {
    showToast(e?.message || '中队重命名失败', 'error')
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
    showToast('区队名称已更新')
    await load()
  } catch (e: any) {
    showToast(e?.message || '区队重命名失败', 'error')
  } finally {
    savingClassId.value = null
  }
}

/* ===== 新建区队 ===== */
async function handleCreate() {
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
    showToast('区队创建成功')
    newId.value = ''
    newName.value = ''
    newCompanyId.value = ''
    await load()
  } catch (e: any) {
    showToast(e?.message || '新建区队失败', 'error')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <section>
    <h2>中队与区队管理</h2>
    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <!-- 中队 -->
      <div class="section-label">中队</div>
      <div class="company-cards">
        <div v-if="companies.length === 0" class="empty-msg">暂无中队数据</div>
        <div v-for="c in companies" :key="c.id" class="company-card">
          <template v-if="editingCompanyId === c.id">
            <input
              v-model="companyDraft"
              class="inline-input"
              placeholder="中队名称"
              @keyup.enter="saveCompany(c)"
            />
            <div class="company-actions">
              <button class="btn-sm" :disabled="savingCompanyId === c.id" @click="saveCompany(c)">
                {{ savingCompanyId === c.id ? '保存中…' : '保存' }}
              </button>
              <button class="btn-ghost" :disabled="savingCompanyId === c.id" @click="cancelCompanyEdit">取消</button>
            </div>
          </template>
          <template v-else>
            <div class="company-main">
              <span class="company-name">{{ c.name }}</span>
              <span class="company-id">编号 {{ c.id }}</span>
            </div>
            <button class="btn-ghost" @click="startCompanyEdit(c)">重命名</button>
          </template>
        </div>
      </div>

      <!-- 区队 -->
      <div class="section-label">区队</div>
      <div v-if="classes.length === 0" class="empty-msg">暂无区队数据</div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>名称</th>
              <th>所属中队</th>
              <th>在队人数</th>
              <th>干部数</th>
              <th>已离开数</th>
              <th>区队长</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in classes" :key="row.id">
              <td class="col-id">{{ row.id }}</td>
              <td class="col-name">
                <input
                  v-if="editingClassId === row.id"
                  v-model="classDraft"
                  class="inline-input"
                  placeholder="区队名称"
                  @keyup.enter="saveClass(row)"
                />
                <span v-else>{{ row.name }}</span>
              </td>
              <td>{{ row.company_name || row.company_id || '—' }}</td>
              <td>{{ row.students }}</td>
              <td>{{ row.cadres }}</td>
              <td>{{ row.lefts }}</td>
              <td>{{ leaderName(row.id) }}</td>
              <td class="col-actions">
                <template v-if="editingClassId === row.id">
                  <button class="btn-sm" :disabled="savingClassId === row.id" @click="saveClass(row)">
                    {{ savingClassId === row.id ? '保存中…' : '保存' }}
                  </button>
                  <button class="btn-ghost" :disabled="savingClassId === row.id" @click="cancelClassEdit">取消</button>
                </template>
                <button v-else class="btn-ghost" @click="startClassEdit(row)">重命名</button>
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
        <button class="btn-sm create-btn" :disabled="creating" @click="handleCreate">
          {{ creating ? '创建中…' : '新建区队' }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 16px;
}

.section-label {
  font-size: 12px;
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
  border-radius: var(--radius-md, 12px);
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.company-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.company-name { font-size: 14px; font-weight: 600; color: var(--color-text); }
.company-id { font-size: 11px; color: var(--color-text-3); }
.company-actions { display: flex; gap: 6px; }

/* ========== 表格 ========== */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px; }
.data-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.data-table th,
.data-table td {
  text-align: left;
  padding: 8px 10px;
  font-size: 13px;
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
.col-actions { display: flex; gap: 6px; align-items: center; }

/* ========== 新建表单 ========== */
.create-card {
  background: var(--color-surface);
  border-radius: var(--radius-md, 12px);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}
.create-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--color-text-2); }
.text-input,
.inline-input {
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
  background: var(--color-surface);
  color: var(--color-text);
  box-sizing: border-box;
}
.inline-input { width: 100%; min-width: 120px; }
.create-btn { height: 36px; }

/* ========== 按钮 ========== */
.btn-sm {
  padding: 8px 16px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost {
  padding: 8px 14px;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-ghost:hover { background: var(--color-surface-hover); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.loading { padding: 40px; text-align: center; color: var(--color-text-2); font-size: 14px; }
.empty-msg { text-align: center; padding: 20px; color: var(--color-text-3); font-size: 13px; }

/* ========== 响应式 ========== */
@media (max-width: 768px) {
  h2 { font-size: 18px; margin-bottom: 12px; }
  .company-cards { grid-template-columns: 1fr; }
  .create-field { min-width: 100%; }
}
</style>
