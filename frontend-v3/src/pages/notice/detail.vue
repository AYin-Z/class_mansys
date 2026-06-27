<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getNoticeDetail, completeTodo } from '@/api/notice'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import { sanitizeHtml } from '@/utils/sanitize'
import { showToast } from '@/utils/ui'

const route = useRoute()
const userStore = useUserStore()
const notice = ref<any>(null)
const completion = ref<any>(null)
const loading = ref(true)
const completing = ref(false)
const safeContent = computed(() => sanitizeHtml(notice.value?.content || ''))

onMounted(async () => {
  try {
    const id = Number(route.query.id)
    if (!id) return
    const res = await getNoticeDetail(id)
    if (res.success) {
      notice.value = { ...res.notice, is_completed: res.notice.is_completed || false }
      completion.value = res.completion || null
    }
  } catch (_) {}
  finally { loading.value = false }
})

async function handleComplete() {
  if (!notice.value) return
  completing.value = true
  try {
    const res = await completeTodo(notice.value.id)
    if (res.success) {
      notice.value.is_completed = true
      showToast('已标记完成')
      // Refresh completion list
      if (userStore.isAdmin) {
        const detail = await getNoticeDetail(notice.value.id)
        if (detail.success) completion.value = detail.completion || null
      }
    }
  } catch (e: any) {
    showToast(e.message || '操作失败', 'error')
  }
  finally { completing.value = false }
}
</script>

<template>
  <div class="detail-page">
    <NavBar title="通知详情" show-back />

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="!notice" class="state">通知不存在</div>

    <div v-else class="detail-content">
      <div class="tags">
        <span v-if="notice.priority > 0" class="tag-badge important">重要</span>
        <span v-if="notice.is_todo" class="tag-badge todo">待办</span>
        <span class="meta">{{ notice.creator_name || '' }} · {{ notice.created_at ? new Date(notice.created_at).toLocaleDateString('zh-CN') : '' }}</span>
      </div>

      <h2>{{ notice.title }}</h2>

      <div class="body" v-html="safeContent"></div>

      <!-- 待办操作 -->
      <div v-if="notice.is_todo" class="todo-section">
        <button
          v-if="!notice.is_completed"
          class="complete-btn"
          :disabled="completing"
          @click="handleComplete"
        >
          {{ completing ? '提交中…' : '✅ 标记完成' }}
        </button>
        <div v-else class="completed-badge">✅ 你已完成</div>
      </div>

      <!-- 管理员：完成情况 -->
      <div v-if="userStore.isAdmin && completion" class="completion-section">
        <h3>完成情况 ({{ completion.completed?.length || 0 }}/{{ completion.total }})</h3>
        <div v-if="completion.completed?.length" class="done-list">
          <span v-for="u in completion.completed" :key="u.id" class="done-user">
            ✅ {{ u.name }}
          </span>
        </div>
        <div v-if="completion.pending?.length" class="pending-list">
          <div class="pending-label">未完成 ({{ completion.pending.length }})</div>
          <span v-for="u in completion.pending" :key="u.id" class="pending-user">
            {{ u.name }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page { padding-bottom: 80px; }
.state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.detail-content { padding: 20px 16px; }
.tags { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.tag-badge {
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
}
.tag-badge.important { background: var(--color-error-bg); color: var(--color-error); }
.tag-badge.todo { background: var(--color-warning-bg); color: var(--color-warning); }
.meta { font-size: 12px; color: var(--color-text-3); }
h2 { font-size: 20px; font-weight: 700; line-height: 1.3; margin-bottom: 16px; color: var(--color-text); }
.body { font-size: 15px; line-height: 1.8; color: var(--color-text-2); }
.body :deep(p) { margin-bottom: 10px; }
.body :deep(img) { max-width: 100%; border-radius: 8px; margin: 12px 0; }

/* 待办操作 */
.todo-section { margin-top: 24px; text-align: center; }
.complete-btn {
  width: 100%; height: 48px; border: none; border-radius: var(--radius-md);
  background: var(--color-success); color: #fff; font-size: 16px; font-weight: 600;
  cursor: pointer;
}
.complete-btn:disabled { opacity: 0.5; }
.completed-badge {
  display: inline-block; padding: 10px 24px; border-radius: var(--radius-md);
  background: #dcfce7; color: #16a34a; font-size: 15px; font-weight: 600;
}

/* 完成情况 */
.completion-section {
  margin-top: 24px; padding: 16px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
}
.completion-section h3 {
  font-size: 14px; font-weight: 600; color: var(--color-text);
  margin-bottom: 12px;
}
.done-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.done-user {
  font-size: 12px; padding: 2px 8px; border-radius: var(--radius-sm);
  background: #dcfce7; color: #16a34a;
}
.pending-label {
  font-size: 12px; font-weight: 600; color: var(--color-text-3); margin-bottom: 6px;
}
.pending-list { display: flex; flex-wrap: wrap; gap: 6px; }
.pending-user {
  font-size: 12px; padding: 2px 8px; border-radius: var(--radius-sm);
  background: var(--color-surface-hover); color: var(--color-text-2);
}
</style>
