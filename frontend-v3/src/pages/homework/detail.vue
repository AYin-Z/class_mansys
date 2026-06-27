<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getHomeworkDetail, submitHomework } from '@/api/homework'
import type { HomeworkItem, HomeworkSubmission } from '@/api/homework'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'
import { sanitizeHtml } from '@/utils/sanitize'

const route = useRoute()
const homework = ref<HomeworkItem | null>(null)
const mySubmission = ref<HomeworkSubmission | null>(null)
const submissions = ref<HomeworkSubmission[]>([])
const loading = ref(true)
const submitting = ref(false)
const fileUrl = ref('')
const fileName = ref('')
const safeDescription = computed(() => sanitizeHtml(homework.value?.description || ''))

onMounted(async () => {
  try {
    const id = Number(route.query.id)
    if (!id) return
    const res = await getHomeworkDetail(id)
    if (res.success) {
      homework.value = res.homework
      mySubmission.value = res.mySubmission || null
      submissions.value = res.submissions || []
    }
  } catch (_) {}
  finally { loading.value = false }
})

function isOverdue(deadline: string) {
  return new Date(deadline) < new Date()
}

async function handleSubmit() {
  if (!fileUrl.value || !fileName.value) {
    showToast('请填写提交信息', 'error')
    return
  }
  if (!homework.value) return
  submitting.value = true
  try {
    const res = await submitHomework(homework.value.id, { file_url: fileUrl.value, file_name: fileName.value })
    if (res.success) {
      showToast('提交成功')
      mySubmission.value = { homework_id: homework.value.id, user_id: 0, file_url: fileUrl.value, file_name: fileName.value, status: 0, submitted_at: new Date().toISOString() } as HomeworkSubmission
      fileName.value = ''
      fileUrl.value = ''
    } else {
      showToast('提交失败', 'error')
    }
  } catch (_) {
    showToast('提交失败', 'error')
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <div class="detail-page">
    <NavBar title="作业详情" show-back />
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="!homework" class="empty-state">作业不存在</div>

    <div v-else class="content">
      <h2>{{ homework.title }}</h2>
      <div class="meta-row">
        <span>{{ homework.creator_name || '' }}</span>
        <span>发布 {{ homework.created_at?.slice(0, 10) }}</span>
        <span>{{ isOverdue(homework.deadline) ? '已截止' : '进行中' }}</span>
      </div>

      <div class="section">
        <h3>作业说明</h3>
        <div class="desc" v-html="safeDescription"></div>
      </div>

      <!-- 截至时间 -->
      <div class="deadline-row" :class="{ overdue: isOverdue(homework.deadline) }">
        截止时间：{{ homework.deadline?.slice(0, 16) }}
      </div>

      <!-- 我的提交 -->
      <div class="section">
        <h3>我的提交</h3>
        <div v-if="mySubmission" class="submission-info">
          <p>已提交：{{ mySubmission.file_name }}</p>
          <p>提交时间：{{ mySubmission.submitted_at?.slice(0, 16) }}</p>
          <span :class="['grade-badge', mySubmission.status === 1 ? 'graded' : '']">
            {{ mySubmission.status === 1 ? `已批改 ${mySubmission.score ?? ''}分` : '待批改' }}
          </span>
        </div>
        <div v-else-if="!isOverdue(homework.deadline)" class="submit-form">
          <input v-model="fileName" placeholder="文件名（如 学号_姓名_作业1）" class="input" />
          <input v-model="fileUrl" placeholder="文件链接（或上传后粘贴链接）" class="input" />
          <button class="submit-btn" :disabled="submitting" @click="handleSubmit">
            {{ submitting ? '提交中...' : '提交作业' }}
          </button>
        </div>
        <div v-else class="overdue-text">已截止，无法提交</div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.detail-page { padding-bottom: 80px; }
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.content { padding: 20px 16px; }
h2 { font-size: 20px; font-weight: 700; line-height: 1.3; margin-bottom: 8px; color: var(--color-text); }
.meta-row { display: flex; gap: 12px; font-size: 12px; color: var(--color-text-3); margin-bottom: 20px; }
.section { margin-bottom: 20px; }
.section h3 { font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.desc { font-size: 14px; line-height: 1.7; color: var(--color-text-2); }
.desc :deep(p) { margin-bottom: 8px; }
.deadline-row {
  padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--color-accent-bg); color: var(--color-accent);
  font-size: 14px; font-weight: 500; margin-bottom: 20px;
}
.deadline-row.overdue { background: var(--color-error-bg); color: var(--color-error); }
.submission-info { font-size: 14px; color: var(--color-text-2); line-height: 1.7; }
.grade-badge { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 4px; background: var(--color-accent-bg); color: var(--color-accent); }
.grade-badge.graded { background: #dcfce7; color: #16a34a; }
.submit-form { display: flex; flex-direction: column; gap: 10px; }
.input {
  width: 100%; padding: 12px 14px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: 14px; outline: none;
  background: var(--color-surface); color: var(--color-text);
  box-sizing: border-box;
}
.input:focus { border-color: var(--color-accent); }
.submit-btn {
  height: 44px; border: none; border-radius: var(--radius-md);
  background: var(--color-accent); color: #fff; font-size: 15px; font-weight: 600;
  cursor: pointer;
}
.submit-btn:disabled { opacity: 0.5; }
.overdue-text { font-size: 14px; color: var(--color-text-3); }
</style>
