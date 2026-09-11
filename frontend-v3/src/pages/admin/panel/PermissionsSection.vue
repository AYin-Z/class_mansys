<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getPermissionMatrix, updatePermissionMatrix, type PermissionKeyRow } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import { showToast } from '@/utils/ui'

const loading = ref(true)
const keys = ref<PermissionKeyRow[]>([])
const draft = ref<Record<string, number[]>>({})
const saving = ref<string | null>(null)

/** 可配置的角色（与后端 ROLES 一致） */
const ROLES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const roleLabel = (r: number) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] || ('角色' + r)

const dirtyKeys = computed(() => keys.value.filter((k) => !sameSet(draft.value[k.key] || [], k.roles)).map((k) => k.key))

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort((x, y) => x - y)
  const sb = [...b].sort((x, y) => x - y)
  return sa.every((v, i) => v === sb[i])
}

async function load() {
  loading.value = true
  try {
    const res = await getPermissionMatrix()
    if (res?.success) {
      keys.value = res.data.keys || []
      const d: Record<string, number[]> = {}
      for (const k of keys.value) d[k.key] = [...k.roles]
      draft.value = d
    }
  } catch (e: any) {
    showToast(e?.message || '加载权限矩阵失败', 'error')
  } finally {
    loading.value = false
  }
}

function toggle(key: string, role: number) {
  const list = draft.value[key] || []
  const i = list.indexOf(role)
  if (i > -1) list.splice(i, 1)
  else list.push(role)
  draft.value = { ...draft.value, [key]: [...list] }
}

function isChecked(key: string, role: number): boolean {
  return (draft.value[key] || []).indexOf(role) > -1
}

async function saveKey(key: string) {
  saving.value = key
  try {
    const res = await updatePermissionMatrix(key, draft.value[key] || [])
    if (res?.success) {
      const target = keys.value.find((k) => k.key === key)
      if (target) target.roles = [...(res.data?.roles || [])]
      showToast('已保存')
    }
  } catch (e: any) {
    showToast(e?.message || '保存失败', 'error')
  } finally {
    saving.value = null
  }
}

function resetKey(row: PermissionKeyRow) {
  draft.value = { ...draft.value, [row.key]: [...row.defaultRoles] }
}

async function saveAll() {
  for (const key of dirtyKeys.value) {
    // 串行保存，避免并发写同一权限表
    await saveKey(key)
  }
}
</script>

<template>
  <section>
    <div class="sec-head">
      <h2>权限矩阵</h2>
      <div class="head-actions">
        <span v-if="dirtyKeys.length" class="dirty">{{ dirtyKeys.length }} 项未保存</span>
        <button class="btn-primary" :disabled="!dirtyKeys.length || !!saving" @click="saveAll">保存全部</button>
        <button class="btn-sm" @click="load">刷新</button>
      </div>
    </div>

    <p class="tips">
      权限即时生效（服务端内存缓存会随保存刷新）。为避免把自己锁死，<b>系统管理员对「配置权限矩阵」的权限不可移除</b>。
      修改会影响所有用户：例如取消「审批请假」中的区队长，则该区队长将无法审批。
    </p>

    <div v-if="loading" class="loading">加载中…</div>
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="perm-col">权限</th>
            <th v-for="r in ROLES" :key="r" class="role-col">{{ roleLabel(r) }}</th>
            <th class="act-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in keys" :key="row.key" :class="{ changed: !sameSet(draft[row.key] || [], row.roles) }">
            <td class="perm-col">
              <div class="perm-name">{{ row.label }}</div>
              <div class="perm-key">{{ row.key }}</div>
            </td>
            <td v-for="r in ROLES" :key="r" class="role-col">
              <input type="checkbox" :checked="isChecked(row.key, r)" @change="toggle(row.key, r)" />
            </td>
            <td class="act-col">
              <button class="btn-xs" @click="resetKey(row)">恢复默认</button>
              <button class="btn-xs" :disabled="saving === row.key" @click="saveKey(row.key)">
                {{ saving === row.key ? '保存中…' : '保存' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
h2 { font-size: 18px; margin: 0 0 8px; color: var(--color-text); }
.head-actions { display: flex; align-items: center; gap: 8px; }
.dirty { font-size: 12px; color: var(--color-warning); }
.tips { font-size: 12px; line-height: 1.7; color: var(--color-text-3); margin: 6px 0 12px; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--color-surface); }
.data-table th, .data-table td { border-bottom: 1px solid var(--color-border); padding: 6px 8px; text-align: center; color: var(--color-text-2); }
.data-table th { color: var(--color-text-3); font-size: 12px; white-space: nowrap; }
.perm-col { text-align: left; min-width: 190px; }
.role-col { width: 62px; }
.act-col { white-space: nowrap; width: 130px; }
.perm-name { font-size: 13px; color: var(--color-text); }
.perm-key { font-size: 10px; color: var(--color-text-3); font-family: ui-monospace, Menlo, monospace; }
tr.changed { background: var(--color-accent-bg); }
.btn-sm, .btn-xs, .btn-primary { cursor: pointer; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-2); border-radius: 8px; }
.btn-sm { font-size: 12px; padding: 5px 10px; }
.btn-xs { font-size: 11px; padding: 3px 7px; border-radius: 6px; margin-left: 4px; }
.btn-primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-size: 13px; padding: 7px 14px; border-radius: 8px; }
.btn-primary:disabled { opacity: .6; }
.loading { color: var(--color-text-3); font-size: 13px; padding: 12px 0; }
</style>
