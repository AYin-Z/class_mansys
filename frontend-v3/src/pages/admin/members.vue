<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listMembers } from '@/api/admin'
import type { AdminMember } from '@/api/admin'
import { ROLE_LABELS } from '@/types/roles'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const members = ref<AdminMember[]>([])
const loading = ref(true)
const keyword = ref('')
const total = ref(0)

async function loadData() {
  loading.value = true
  try {
    const res = await listMembers({ keyword: keyword.value || undefined })
    if (res.success) {
      members.value = res.members || []
      total.value = res.total
    }
  } catch (_) {}
  finally { loading.value = false }
}

onMounted(loadData)

function goDetail(id: number) {
  router.push({ path: '/pages/admin/member-detail', query: { id: String(id) } })
}

function doSearch() { loadData() }
function clearSearch() { keyword.value = ''; loadData() }

function roleLabel(r: number) { return ROLE_LABELS[r] || '学员' }
function roleClass(r: number) { return r > 0 ? 'cadre' : 'student' }

function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="page">
    <NavBar title="成员管理" show-back />

    <!-- 搜索 -->
    <div class="search-bar">
      <input v-model="keyword" class="search-input" placeholder="搜索姓名/学号/手机号" @keyup.enter="doSearch" />
      <button class="search-btn" @click="doSearch">搜索</button>
      <button v-if="keyword" class="clear-btn" @click="clearSearch">清除</button>
    </div>

    <div class="total-info">共 {{ total }} 人</div>

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="members.length === 0" class="state">无匹配成员</div>

    <div v-for="m in members" :key="m.id" class="card" @click="goDetail(m.id)">
      <div class="card-avatar">{{ m.name?.charAt(0) || '?' }}</div>
      <div class="card-body">
        <div class="card-name">{{ m.name }}</div>
        <div class="card-meta">
          <span>{{ m.student_id }}</span>
          <span :class="['role-tag', roleClass(m.role)]">{{ roleLabel(m.role) }}</span>
          <span v-if="m.duty_note" class="duty-tag">{{ m.duty_note }}</span>
          <span v-if="m.class_name">{{ m.class_name }}</span>
        </div>
      </div>
      <div class="card-stats">
        <div v-if="m.active_leave_count > 0" class="stat leave">🏥</div>
        <div v-if="m.last_action_at" class="stat active">🟢</div>
      </div>
      <span class="arrow">›</span>
    </div>
  </div>
</template>

<style scoped>
.page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

.search-bar { display: flex; gap: 8px; padding: 12px 16px; }
.search-input {
  flex: 1; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; background: var(--color-surface);
  color: var(--color-text); outline: none;
}
.search-btn, .clear-btn {
  padding: 10px 14px; border: none; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.search-btn { background: var(--color-accent); color: #fff; }
.clear-btn { background: var(--color-surface-hover); color: var(--color-text-2); }

.total-info { padding: 0 16px 8px; font-size: 12px; color: var(--color-text-3); }

.card {
  display: flex; align-items: center; gap: 12px;
  margin: 0 12px 8px; padding: 14px 16px;
  border-radius: var(--radius-md); background: var(--color-surface);
  box-shadow: var(--shadow-card); cursor: pointer;
}
.card-avatar {
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--color-accent-bg); color: var(--color-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; flex-shrink: 0;
}
.card-body { flex: 1; min-width: 0; }
.card-name { font-size: 15px; font-weight: 600; color: var(--color-text); }
.card-meta { font-size: 12px; color: var(--color-text-3); margin-top: 3px; display: flex; gap: 8px; align-items: center; }
.role-tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.role-tag.cadre { background: var(--color-accent-bg); color: var(--color-accent); }
.role-tag.student { background: var(--color-surface-hover); color: var(--color-text-3); }
.duty-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--color-accent-bg); color: var(--color-accent);
}
.card-stats { display: flex; gap: 4px; font-size: 14px; }
.arrow { font-size: 20px; color: var(--color-text-3); flex-shrink: 0; }
</style>
