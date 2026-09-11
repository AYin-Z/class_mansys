<script setup lang="ts">
/**
 * 成员管理（名册）
 *
 * 2026-09（B7）修复：
 *  - `catch (_) {}` 把加载失败吞成「无匹配成员」——干部会以为名册真的空了。
 *    现在 StateView 三态：loading / error+重试 / empty，且搜索无结果显示 filtered 变体。
 *  - 角色名改用 @/types/roles 的 getRoleLabel()（辅导员 role=9 之前会显示成「学员」）。
 *  - emoji 图标（🏥🟢）换 AppIcon，箭头换 chevron，去掉手写 80px 底部避让。
 *
 * 注：本页是只读名册，没有删除/批量等破坏性操作（角色变更在成员详情页），
 *     因此不需要 showConfirm —— 见交付说明。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listMembers } from '@/api/admin'
import type { AdminMember } from '@/api/admin'
import { getRoleLabel } from '@/types/roles'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const members = ref<AdminMember[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const keyword = ref('')
/** 上一次真正生效的搜索词：用于区分「搜索无结果」与「名册为空」 */
const appliedKeyword = ref('')
const total = ref(0)
// 分页：此前未传 page/pageSize，后端默认只返回前 50 人
const page = ref(1)
const pageSize = ref(50)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await listMembers({
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res.success) {
      members.value = res.members || []
      total.value = res.total
      appliedKeyword.value = keyword.value.trim()
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function goDetail(id: number) {
  router.push({ path: '/pages/admin/member-detail', query: { id: String(id) } })
}

function doSearch() { page.value = 1; loadData() }
function clearSearch() { keyword.value = ''; page.value = 1; loadData() }

function changePage(delta: number) {
  const next = page.value + delta
  if (next < 1 || next > totalPages.value) return
  page.value = next
  loadData()
}

function roleLabel(r: number) { return getRoleLabel(r) }
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
      <button class="search-btn" type="button" @click="doSearch">搜索</button>
      <button v-if="keyword" class="clear-btn" type="button" @click="clearSearch">清除</button>
    </div>

    <div v-if="!loading && !error" class="total-info">共 {{ total }} 人</div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="members.length === 0"
      :empty-variant="appliedKeyword ? 'filtered' : 'default'"
      empty-icon="users"
      :empty-title="appliedKeyword ? `没有匹配「${appliedKeyword}」的成员` : '还没有成员数据'"
      :empty-description="appliedKeyword ? '试试只搜姓名或学号的一部分' : '名册导入后这里会显示全班同学'"
      :empty-action-text="appliedKeyword ? '清除搜索' : ''"
      @retry="loadData"
      @empty-action="clearSearch"
    >
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
          <AppIcon
            v-if="m.active_leave_count > 0"
            class="stat leave"
            name="calendar"
            :size="15"
            title="有在途请假"
          />
          <AppIcon
            v-if="m.last_action_at"
            class="stat active"
            name="activity"
            :size="15"
            :title="`最近活跃：${formatDate(m.last_action_at)}`"
          />
        </div>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
    </StateView>

    <!-- 分页 -->
    <div v-if="!loading && !error && total > 0" class="pager">
      <button class="page-btn" type="button" :disabled="page <= 1" @click="changePage(-1)">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button class="page-btn" type="button" :disabled="page >= totalPages" @click="changePage(1)">下一页</button>
    </div>
  </div>
</template>

<style scoped>
/* 底部避让由 App.vue 统一处理（calc(var(--tabbar-h) + safe-area)） */
.page { min-height: 100vh; background: var(--color-bg); }

.search-bar { display: flex; gap: 8px; padding: 12px 16px; }
.search-input {
  flex: 1; min-height: 44px; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; background: var(--color-surface);
  color: var(--color-text); outline: none;
}
.search-btn, .clear-btn {
  min-height: 44px; padding: 10px 14px; border: none; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.search-btn { background: var(--color-accent); color: var(--color-text-on-primary); }
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
.card-meta { font-size: 12px; color: var(--color-text-3); margin-top: 3px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.role-tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.role-tag.cadre { background: var(--color-accent-bg); color: var(--color-accent); }
.role-tag.student { background: var(--color-surface-hover); color: var(--color-text-3); }
.duty-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--color-accent-bg); color: var(--color-accent);
}
.card-stats { display: flex; gap: 6px; flex-shrink: 0; }
.stat.leave { color: var(--color-warning); }
.stat.active { color: var(--color-success); }
.arrow { color: var(--color-text-3); flex-shrink: 0; }

.pager {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-top: 12px; font-size: 13px; color: var(--color-text-3);
}
.page-btn {
  min-height: 44px; padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-surface); color: var(--color-text-2); font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
