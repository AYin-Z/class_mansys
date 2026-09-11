<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getHomeworks, createHomework } from '@/api/homework'
import type { HomeworkItem } from '@/api/homework'
import NavBar from '@/components/ui/NavBar.vue'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/ui'

const router = useRouter()
const userStore = useUserStore()
const homeworks = ref<HomeworkItem[]>([])
const loading = ref(true)

/** 发布作业（干部）：审计修复——后端一直有 createHomework，前端却没有任何入口 */
const canPublish = computed(() => userStore.hasPermission('PUBLISH_HOMEWORK'))
const showCreate = ref(false)
const form = ref({ title: '', description: '', deadline: '' })
const saving = ref(false)

function openCreate() {
  form.value = { title: '', description: '', deadline: '' }
  showCreate.value = true
}

async function doCreate() {
  if (!form.value.title.trim()) { showToast('请填写作业标题', 'error'); return }
  if (!form.value.deadline) { showToast('请选择截止时间', 'error'); return }
  if (new Date(form.value.deadline.replace('T', ' ')) <= new Date()) { showToast('截止时间必须晚于当前时间', 'error'); return }
  saving.value = true
  try {
    await createHomework({
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      deadline: form.value.deadline.replace('T', ' ')
    } as any)
    showToast('作业已发布')
    showCreate.value = false
    const res = await getHomeworks()
    if (res.success) homeworks.value = res.homeworks || []
  } catch (e: any) {
    showToast(e?.message || '发布失败', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const res = await getHomeworks()
    if (res.success) homeworks.value = res.homeworks || []
  } catch (_) {}
  finally { loading.value = false }
})

function goDetail(id: number) {
  router.push({ path: '/pages/homework/detail', query: { id: String(id) } })
}

function isOverdue(deadline: string) {
  return new Date(deadline) < new Date()
}
</script>
<template>
  <div class="hw-page">
    <NavBar title="作业管理" />

    <div v-if="canPublish" class="page-actions">
      <button class="btn-primary" @click="openCreate">+ 发布作业</button>
    </div>

    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="homeworks.length === 0" class="empty-state">暂无作业</div>

    <div v-for="item in homeworks" :key="item.id" class="hw-card" @click="goDetail(item.id)">
      <div class="card-header">
        <div class="title">{{ item.title }}</div>
        <span :class="['status-tag', isOverdue(item.deadline) ? 'overdue' : 'active']">
          {{ isOverdue(item.deadline) ? '已截止' : '进行中' }}
        </span>
      </div>
      <div class="desc">{{ item.description?.replace(/<[^>]*>/g, '').slice(0, 100) }}</div>
      <div class="meta">
        <span>{{ item.creator_name || '' }}</span>
        <span>截止 {{ item.deadline?.slice(0, 10) }}</span>
        <span v-if="item.submission_count !== undefined">{{ item.submission_count }} 人已交</span>
      </div>
    </div>

    <div v-if="showCreate" class="mask" @click.self="showCreate = false">
      <div class="modal">
        <h3>发布作业</h3>
        <label>标题<input v-model="form.title" placeholder="如：第3章课后习题" /></label>
        <label>要求说明<textarea v-model="form.description" rows="3" placeholder="作业要求、提交格式等"></textarea></label>
        <label>截止时间<input v-model="form.deadline" type="datetime-local" /></label>
        <div class="modal-actions">
          <button class="btn-ghost" @click="showCreate = false">取消</button>
          <button class="btn-primary" :disabled="saving" @click="doCreate">{{ saving ? '发布中…' : '发布' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.hw-page { padding-bottom: 80px; }
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.hw-card {
  margin: 8px 12px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
  padding: 16px; cursor: pointer;
}
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 8px; }
.title { font-size: 15px; font-weight: 600; color: var(--color-text); flex: 1; }
.status-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.status-tag.active { background: var(--color-accent-bg); color: var(--color-accent); }
.status-tag.overdue { background: var(--color-error-bg); color: var(--color-error); }
.desc { font-size: 13px; color: var(--color-text-2); line-height: 1.5; margin-bottom: 8px; }
.meta { display: flex; gap: 12px; font-size: 12px; color: var(--color-text-3); }
.page-actions { display: flex; justify-content: flex-end; padding: 10px 12px 0; }
.btn-primary, .btn-ghost { cursor: pointer; border-radius: 8px; font-size: 13px; padding: 8px 14px; border: 1px solid var(--color-accent); background: var(--color-accent); color: #fff; }
.btn-ghost { background: var(--color-surface); color: var(--color-text-2); border-color: var(--color-border); }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
.modal { width: 100%; max-width: 420px; background: var(--color-surface); border-radius: var(--radius-md, 12px); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.modal h3 { margin: 0; font-size: 16px; color: var(--color-text); }
.modal label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--color-text-3); }
.modal input, .modal textarea { font-size: 13px; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-family: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
