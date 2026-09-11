<script setup lang="ts">
/**
 * 作业详情
 *
 * 2026-09（体验修复）：
 *  - 加载失败不再被 `catch (_) {}` 吞成「作业不存在」→ error + 重试
 *  - 提交作业支持真实上传附件（uploadFile），外链保留为兜底；字段级校验提示
 *  - 提交/批改成功给成功 toast，失败走 toastIfNotNotified（不覆盖后端具体原因）
 *  - 底部避让交给 App.vue，删除手写 padding-bottom: 80px
 */
import { computed, reactive, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getHomeworkDetail, gradeSubmission, submitHomework, uploadHomeworkAttachment } from '@/api/homework'
import type { HomeworkItem, HomeworkSubmission } from '@/api/homework'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import { sanitizeHtml } from '@/utils/sanitize'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
const homework = ref<HomeworkItem | null>(null)
const mySubmission = ref<HomeworkSubmission | null>(null)
const submissions = ref<HomeworkSubmission[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const submitting = ref(false)
const fileUrl = ref('')
const fileName = ref('')
const formErrors = ref<{ fileName?: string; file?: string }>({})
const safeDescription = computed(() => sanitizeHtml(homework.value?.description || ''))

// 附件上传（复用统一上传封装：带超时 / 401 处理）
const uploading = ref(false)
const uploadedName = ref('')
const uploadInput = ref<HTMLInputElement | null>(null)

function triggerUpload() {
  uploadInput.value?.click()
}

async function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 100 * 1024 * 1024) {
    showToast('文件不能超过 100MB', 'error')
    target.value = ''
    return
  }
  uploading.value = true
  try {
    const res = await uploadHomeworkAttachment(file)
    if (res.success && res.url) {
      fileUrl.value = res.url
      uploadedName.value = file.name
      if (!fileName.value.trim()) fileName.value = file.name
      formErrors.value = { ...formErrors.value, file: '' }
      showToast('附件上传成功', 'success')
    }
  } catch (err) {
    toastIfNotNotified(err, '上传失败，请稍后重试')
  } finally {
    uploading.value = false
    target.value = ''
  }
}

function clearAttachment() {
  uploadedName.value = ''
  fileUrl.value = ''
}

// 批改作业需要 GRADE_HOMEWORK 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canGradeHomework = computed(() => userStore.hasPermission('GRADE_HOMEWORK'))
const gradingId = ref<number | null>(null)
// 每个待批改提交的评分草稿
const gradeDrafts = reactive<Record<number, { score: string; feedback: string }>>({})

function initGradeDrafts(list: HomeworkSubmission[]) {
  for (const s of list) {
    if (!gradeDrafts[s.id]) gradeDrafts[s.id] = { score: '', feedback: '' }
  }
}

async function handleGrade(sub: HomeworkSubmission) {
  const draft = gradeDrafts[sub.id]
  const score = Number(draft?.score)
  if (!draft || draft.score === '' || Number.isNaN(score)) {
    showToast('请输入分数', 'error')
    return
  }
  if (gradingId.value !== null) return
  gradingId.value = sub.id
  try {
    const res = await gradeSubmission(sub.id, { score, feedback: draft.feedback.trim() || undefined })
    if (res.success) {
      showToast('批改完成', 'success')
      sub.status = 1
      sub.score = score
      sub.feedback = draft.feedback.trim() || null
    }
  } catch (e) {
    toastIfNotNotified(e, '批改失败，请稍后重试')
  } finally {
    gradingId.value = null
  }
}

async function load() {
  loading.value = true
  error.value = null
  const id = Number(route.query.id)
  if (!id) {
    // 无 id：直接进空态，不能停在 loading
    loading.value = false
    return
  }
  try {
    const res = await getHomeworkDetail(id)
    if (res.success) {
      homework.value = res.homework
      mySubmission.value = res.mySubmission || null
      submissions.value = res.submissions || []
      initGradeDrafts(submissions.value)
    } else {
      error.value = new Error('加载作业详情失败，请稍后重试')
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

function isOverdue(deadline: string) {
  return new Date(deadline) < new Date()
}

async function handleSubmit() {
  if (submitting.value) return
  const errs: { fileName?: string; file?: string } = {}
  if (!fileName.value.trim()) errs.fileName = '请填写文件名'
  if (!fileUrl.value.trim()) errs.file = '请上传附件或填写链接'
  formErrors.value = errs
  if (errs.fileName || errs.file) return
  if (!homework.value) return

  submitting.value = true
  try {
    const res = await submitHomework(homework.value.id, {
      file_url: fileUrl.value.trim(),
      file_name: fileName.value.trim(),
    })
    if (res.success) {
      showToast('提交成功', 'success')
      mySubmission.value = {
        homework_id: homework.value.id,
        user_id: 0,
        file_url: fileUrl.value.trim(),
        file_name: fileName.value.trim(),
        status: 0,
        submitted_at: new Date().toISOString(),
      } as HomeworkSubmission
      fileName.value = ''
      fileUrl.value = ''
      uploadedName.value = ''
      formErrors.value = {}
    }
  } catch (e) {
    toastIfNotNotified(e, '提交失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <div class="detail-page">
    <NavBar title="作业详情" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="!homework"
      loading-text="正在加载作业详情…"
      empty-icon="clipboard"
      empty-title="作业不存在"
      empty-description="作业可能已被删除，请返回列表重新进入"
      @retry="load"
    >
      <div v-if="homework" class="content">
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
          <AppIcon name="clock" :size="15" />
          <span>截止时间：{{ homework.deadline?.slice(0, 16) }}</span>
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
            <FormField label="文件名" required :error="formErrors.fileName">
              <input v-model="fileName" class="input" placeholder="如 学号_姓名_作业1" />
            </FormField>

            <FormField label="附件" :error="formErrors.file">
              <div class="upload-row">
                <BaseButton
                  variant="secondary"
                  :loading="uploading"
                  :disabled="uploading"
                  @click="triggerUpload"
                >
                  <AppIcon name="upload" :size="16" />
                  <span>{{ uploading ? '上传中…' : '上传附件' }}</span>
                </BaseButton>
                <span v-if="uploadedName" class="uploaded-name">
                  <AppIcon name="file" :size="14" />
                  {{ uploadedName }}
                  <button class="uploaded-del" type="button" aria-label="移除附件" @click="clearAttachment">
                    <AppIcon name="close" :size="13" />
                  </button>
                </span>
              </div>
            </FormField>
            <input ref="uploadInput" type="file" class="file-hidden" @change="handleFileChange" />

            <div class="link-fallback">
              <span class="fallback-label">或粘贴文件链接（兜底）</span>
              <input v-model="fileUrl" class="input" placeholder="https://…" />
            </div>

            <BaseButton block :loading="submitting" :disabled="submitting" @click="handleSubmit">
              {{ submitting ? '提交中…' : '提交作业' }}
            </BaseButton>
          </div>

          <div v-else class="overdue-text">已截止，无法提交</div>
        </div>

        <!-- 提交批改（需 GRADE_HOMEWORK 权限） -->
        <div v-if="canGradeHomework" class="section">
          <h3>提交情况</h3>
          <div v-if="submissions.length === 0" class="overdue-text">暂无提交</div>
          <div v-for="sub in submissions" :key="sub.id" class="grade-row">
            <div class="grade-head">
              <span class="grade-name">{{ sub.user_name || sub.student_id || ('用户' + sub.user_id) }}</span>
              <span class="grade-file">{{ sub.file_name }}</span>
              <span :class="['grade-badge', sub.status === 1 ? 'graded' : '']">
                {{ sub.status === 1 ? `已批改 ${sub.score ?? ''}分` : '待批改' }}
              </span>
            </div>
            <div v-if="sub.status !== 1" class="grade-form">
              <input v-model="gradeDrafts[sub.id].score" class="input" placeholder="分数" />
              <input v-model="gradeDrafts[sub.id].feedback" class="input" placeholder="评语（可选）" />
              <BaseButton
                :loading="gradingId === sub.id"
                :disabled="gradingId !== null"
                @click="handleGrade(sub)"
              >
                {{ gradingId === sub.id ? '批改中…' : '批改' }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </StateView>
  </div>
</template>
<style scoped>
.detail-page { min-height: 100vh; }
.content { padding: 20px 16px; }
h2 { font-size: var(--font-size-title); font-weight: 700; line-height: 1.3; margin-bottom: 8px; color: var(--color-text); }
.meta-row { display: flex; gap: 12px; font-size: var(--font-size-xs); color: var(--color-text-3); margin-bottom: 20px; }
.section { margin-bottom: 20px; }
.section h3 { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.desc { font-size: var(--font-size-body); line-height: 1.7; color: var(--color-text-2); }
.desc :deep(p) { margin-bottom: 8px; }
.deadline-row {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--color-accent-bg); color: var(--color-accent);
  font-size: var(--font-size-body); font-weight: 500; margin-bottom: 20px;
}
.deadline-row.overdue { background: var(--color-error-bg); color: var(--color-error); }
.submission-info { font-size: var(--font-size-body); color: var(--color-text-2); line-height: 1.7; }
.grade-badge {
  display: inline-block; margin-top: 6px; font-size: var(--font-size-xs); font-weight: 600;
  padding: 3px 10px; border-radius: var(--radius-sm);
  background: var(--color-accent-bg); color: var(--color-accent);
}
.grade-badge.graded { background: var(--color-success-bg); color: var(--color-success); }
.submit-form { display: flex; flex-direction: column; gap: 12px; }
.input {
  width: 100%; padding: 12px 14px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--font-size-body); outline: none;
  background: var(--color-surface); color: var(--color-text);
  font-family: inherit; box-sizing: border-box;
}
.input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
.upload-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.uploaded-name {
  display: inline-flex; align-items: center; gap: 4px; min-height: 32px;
  font-size: var(--font-size-sm); color: var(--color-text-2);
  background: var(--color-surface-2); border-radius: var(--radius-sm); padding: 4px 8px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.uploaded-del {
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: transparent; color: var(--color-text-3);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
}
.link-fallback { display: flex; flex-direction: column; gap: 6px; }
.fallback-label { font-size: var(--font-size-sm); color: var(--color-text-3); }
.file-hidden { display: none; }
.overdue-text { font-size: var(--font-size-body); color: var(--color-text-3); }
.grade-row { padding: 10px 0; border-bottom: 1px solid var(--color-border); }
.grade-row:last-child { border-bottom: none; }
.grade-head { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm); color: var(--color-text-2); flex-wrap: wrap; }
.grade-name { font-weight: 600; color: var(--color-text); }
.grade-file { color: var(--color-text-3); }
.grade-form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
</style>
