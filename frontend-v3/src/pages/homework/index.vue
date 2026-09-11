<script setup lang="ts">
/**
 * 作业列表
 *
 * 2026-09（体验修复）：
 *  - loading / error+retry / empty 三态（此前 catch (_) {} 把加载失败吞成「暂无作业」）
 *  - 发布作业改用 BaseModal + FormField（字段级校验），成功/失败走统一 toast
 *  - 底部避让交给 App.vue，删除页面手写的 padding-bottom: 80px
 */
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getHomeworks, createHomework } from '@/api/homework'
import type { HomeworkItem } from '@/api/homework'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const router = useRouter()
const userStore = useUserStore()
const homeworks = ref<HomeworkItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

/** 发布作业（干部）：审计修复——后端一直有 createHomework，前端却没有任何入口 */
const canPublish = computed(() => userStore.hasPermission('PUBLISH_HOMEWORK'))
const showCreate = ref(false)
const form = ref({ title: '', description: '', deadline: '' })
const formErrors = ref<{ title?: string; deadline?: string }>({})
const saving = ref(false)

function openCreate() {
  form.value = { title: '', description: '', deadline: '' }
  formErrors.value = {}
  showCreate.value = true
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getHomeworks()
    if (res.success) homeworks.value = res.homeworks || []
    else error.value = new Error('加载作业列表失败，请稍后重试')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

async function doCreate() {
  if (saving.value) return
  const errs: { title?: string; deadline?: string } = {}
  if (!form.value.title.trim()) errs.title = '请填写作业标题'
  if (!form.value.deadline) {
    errs.deadline = '请选择截止时间'
  } else if (new Date(form.value.deadline.replace('T', ' ')) <= new Date()) {
    errs.deadline = '截止时间必须晚于当前时间'
  }
  formErrors.value = errs
  if (errs.title || errs.deadline) return

  saving.value = true
  try {
    await createHomework({
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      deadline: form.value.deadline.replace('T', ' '),
    } as any)
    showToast('发布成功', 'success')
    showCreate.value = false
    await load()
  } catch (e) {
    toastIfNotNotified(e, '发布失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

onMounted(load)

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
      <BaseButton @click="openCreate">
        <AppIcon name="plus" :size="16" />
        <span>发布作业</span>
      </BaseButton>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="homeworks.length === 0"
      loading-text="正在加载作业…"
      empty-icon="clipboard"
      empty-title="还没有作业"
      :empty-description="canPublish ? '点上方「发布作业」布置第一份作业' : '老师发布作业后会显示在这里'"
      @retry="load"
    >
      <div v-for="item in homeworks" :key="item.id" class="hw-card" @click="goDetail(item.id)">
        <div class="card-header">
          <div class="title">{{ item.title }}</div>
          <BaseBadge :variant="isOverdue(item.deadline) ? 'default' : 'success'">
            {{ isOverdue(item.deadline) ? '已截止' : '进行中' }}
          </BaseBadge>
        </div>
        <div class="desc">{{ item.description?.replace(/<[^>]*>/g, '').slice(0, 100) }}</div>
        <div class="meta">
          <span>{{ item.creator_name || '' }}</span>
          <span>截止 {{ item.deadline?.slice(0, 10) }}</span>
          <span v-if="item.submission_count !== undefined">{{ item.submission_count }} 人已交</span>
        </div>
      </div>
    </StateView>

    <BaseModal v-model="showCreate" title="发布作业" :close-on-overlay="false">
      <FormField label="标题" required :error="formErrors.title">
        <input v-model="form.title" class="input" placeholder="如：第3章课后习题" />
      </FormField>
      <FormField label="要求说明">
        <textarea
          v-model="form.description"
          class="input"
          rows="3"
          placeholder="作业要求、提交格式等"
        ></textarea>
      </FormField>
      <FormField label="截止时间" required :error="formErrors.deadline">
        <input v-model="form.deadline" class="input" type="datetime-local" />
      </FormField>
      <template #footer>
        <BaseButton variant="secondary" @click="showCreate = false">取消</BaseButton>
        <BaseButton :loading="saving" @click="doCreate">发布</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
<style scoped>
.hw-page { min-height: 100vh; }
.page-actions { display: flex; justify-content: flex-end; padding: 10px 12px; }
.hw-card {
  margin: 8px 12px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
  padding: 16px; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.hw-card:active { background: var(--color-surface-hover); }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 8px; }
.title { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); flex: 1; }
.desc { font-size: var(--font-size-sm); color: var(--color-text-2); line-height: 1.5; margin-bottom: 8px; }
.meta { display: flex; gap: 12px; font-size: var(--font-size-xs); color: var(--color-text-3); }

/* 弹窗表单控件（FormField 只提供 label/error 容器） */
.input {
  width: 100%; padding: 11px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--font-size-md);
  background: var(--color-surface); color: var(--color-text);
  outline: none; font-family: inherit; box-sizing: border-box;
}
.input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
textarea.input { resize: vertical; min-height: 72px; }
</style>
