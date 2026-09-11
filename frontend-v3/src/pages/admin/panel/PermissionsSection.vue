<script setup lang="ts">
/**
 * 权限矩阵
 *
 * 2026-09 修复（行为不变，只补体验）：
 *  - 加载失败改为 StateView 错误态 + 「重试」（此前只有 toast + 空表格，用户以为没有权限项）
 *  - 「保存全部」影响所有用户 → showConfirm 说明后果；「恢复默认」只改草稿，也提示需要再保存
 *  - 按钮 → BaseButton；窄屏保持表内横向滚动，不撑破页面
 */
import { computed, onMounted, ref } from 'vue'
import { getPermissionMatrix, updatePermissionMatrix, type PermissionKeyRow } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const loading = ref(true)
/** 错误对象：有值即渲染错误态 + 重试 */
const error = ref<unknown>(null)
const keys = ref<PermissionKeyRow[]>([])
const draft = ref<Record<string, number[]>>({})
const saving = ref<string | null>(null)
const savingAll = ref(false)

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
  error.value = null
  try {
    const res = await getPermissionMatrix()
    if (res?.success) {
      keys.value = res.data.keys || []
      const d: Record<string, number[]> = {}
      for (const k of keys.value) d[k.key] = [...k.roles]
      draft.value = d
    } else {
      keys.value = []
      error.value = new Error('权限矩阵加载失败，请稍后重试')
    }
  } catch (e) {
    keys.value = []
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

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
  if (saving.value) return
  saving.value = key
  try {
    const res = await updatePermissionMatrix(key, draft.value[key] || [])
    if (res?.success) {
      const target = keys.value.find((k) => k.key === key)
      if (target) target.roles = [...(res.data?.roles || [])]
      showToast('已保存', 'success')
    }
  } catch (e: any) {
    toastIfNotNotified(e, '保存失败，请稍后重试')
  } finally {
    saving.value = null
  }
}

async function resetKey(row: PermissionKeyRow) {
  const ok = await showConfirm('恢复默认权限', `将「${row.label}」的勾选恢复为系统默认值？`, {
    confirmText: '恢复默认',
    hint: '只修改当前草稿，需要再点「保存」或「保存全部」才会生效。'
  })
  if (!ok) return
  draft.value = { ...draft.value, [row.key]: [...row.defaultRoles] }
}

async function saveAll() {
  if (!dirtyKeys.value.length || saving.value || savingAll.value) return
  const changed = dirtyKeys.value.length
  const ok = await showConfirm('保存全部权限变更', `确定保存 ${changed} 项权限变更，并立即对所有用户生效？`, {
    confirmText: '保存并生效',
    danger: true,
    hint: '权限改动会立刻影响所有用户，例如取消某角色的「审批请假」后，该角色用户将马上无法审批；请确认无误。'
  })
  if (!ok) return
  savingAll.value = true
  try {
    for (const key of dirtyKeys.value) {
      // 串行保存，避免并发写同一权限表
      await saveKey(key)
    }
  } finally {
    savingAll.value = false
  }
}
</script>

<template>
  <section>
    <div class="sec-head">
      <h2>权限矩阵</h2>
      <div class="head-actions">
        <span v-if="dirtyKeys.length" class="dirty">{{ dirtyKeys.length }} 项未保存</span>
        <BaseButton
          size="sm"
          :loading="savingAll"
          :disabled="!dirtyKeys.length || !!saving"
          @click="saveAll"
        >
          保存全部
        </BaseButton>
        <BaseButton variant="secondary" size="sm" :loading="loading" @click="load">刷新</BaseButton>
      </div>
    </div>

    <p class="tips">
      权限即时生效（服务端内存缓存会随保存刷新）。为避免把自己锁死，<b>系统管理员对「配置权限矩阵」的权限不可移除</b>。
      修改会影响所有用户：例如取消「审批请假」中的区队长，则该区队长将无法审批。
    </p>

    <StateView :loading="loading" :error="error" loading-text="正在加载权限矩阵…" @retry="load">
      <div class="table-wrap">
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
                <input type="checkbox" :checked="isChecked(row.key, r)" :disabled="!!saving || savingAll" @change="toggle(row.key, r)" />
              </td>
              <td class="act-col">
                <BaseButton variant="ghost" size="sm" :disabled="!!saving || savingAll" @click="resetKey(row)">
                  恢复默认
                </BaseButton>
                <BaseButton size="sm" :loading="saving === row.key" :disabled="savingAll" @click="saveKey(row.key)">
                  保存
                </BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="hint-mobile">手机上可左右滑动表格查看全部角色列。</p>
    </StateView>
  </section>
</template>

<style scoped>
.sec-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
h2 { font-size: var(--font-size-lg); margin: 0 0 8px; color: var(--color-text); }
.head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dirty { font-size: var(--font-size-xs); color: var(--color-warning); }
.tips { font-size: var(--font-size-xs); line-height: 1.7; color: var(--color-text-3); margin: 6px 0 12px; }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); background: var(--color-surface); }
.data-table th, .data-table td { border-bottom: 1px solid var(--color-border); padding: 6px 8px; text-align: center; color: var(--color-text-2); }
.data-table th { color: var(--color-text-3); font-size: var(--font-size-xs); white-space: nowrap; }
.perm-col { text-align: left; min-width: 150px; position: sticky; left: 0; background: var(--color-surface); z-index: 1; }
.role-col { width: 54px; }
.act-col { white-space: nowrap; width: 150px; }
.act-col :deep(.btn) { margin-left: 4px; }
.perm-name { font-size: var(--font-size-sm); color: var(--color-text); }
.perm-key { font-size: var(--font-size-2xs); color: var(--color-text-3); font-family: ui-monospace, Menlo, monospace; word-break: break-all; }
.data-table input[type='checkbox'] { width: 16px; height: 16px; accent-color: var(--color-accent); }
tr.changed { background: var(--color-accent-bg); }
tr.changed .perm-col { background: var(--color-accent-bg); }
.hint-mobile { display: none; }

@media (max-width: 768px) {
  .head-actions { width: 100%; }
  .head-actions :deep(.btn) { flex: 1; }
  .hint-mobile { display: block; font-size: var(--font-size-2xs); color: var(--color-text-3); margin: 8px 0 0; }
  .role-col { width: 46px; }
  .act-col { width: 140px; }
}
</style>
