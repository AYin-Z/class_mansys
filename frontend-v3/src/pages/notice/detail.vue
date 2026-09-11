<script setup lang="ts">
/**
 * 通知详情
 *
 * 2026-09 体验修复：
 *  - 加载失败 → StateView 错误态 + 重试（原来吞掉后显示「通知不存在」）；
 *  - 「标记完成」用 BaseButton（loading 防重复提交）+ AppIcon，去掉 ✅ emoji；
 *  - 成功/失败提示走 showToast(…, 'success') / toastIfNotNotified，不再覆盖后端具体原因；
 *  - 硬编码色值 #dcfce7/#16a34a 换成 success 令牌。
 */
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getNoticeDetail, completeTodo } from '@/api/notice'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { sanitizeHtml } from '@/utils/sanitize'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const notice = ref<any>(null)
const completion = ref<any>(null)
const loading = ref(true)
const error = ref<unknown>(null)
const completing = ref(false)
const safeContent = computed(() => sanitizeHtml(notice.value?.content || ''))

async function load() {
  loading.value = true
  error.value = null
  try {
    const id = Number(route.query.id)
    if (!id) {
      notice.value = null
      return
    }
    const res = await getNoticeDetail(id)
    if (res.success) {
      notice.value = { ...res.notice, is_completed: res.notice.is_completed || false }
      completion.value = res.completion || null
    }
  } catch (e) {
    error.value = e
    notice.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function handleComplete() {
  if (!notice.value || completing.value) return
  completing.value = true
  try {
    const res = await completeTodo(notice.value.id)
    if (res.success) {
      notice.value.is_completed = true
      showToast('已标记完成', 'success')
      // 管理员额外刷新完成情况；这一步失败不影响「已完成」这个主结果
      if (userStore.isAdmin) {
        try {
          const detail = await getNoticeDetail(notice.value.id)
          if (detail.success) completion.value = detail.completion || null
        } catch (e) {
          void e
        }
      }
    }
  } catch (e) {
    toastIfNotNotified(e, '标记完成失败，请重试')
  } finally {
    completing.value = false
  }
}
</script>

<template>
  <div class="detail-page">
    <NavBar title="通知详情" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="!notice"
      loading-text="正在加载通知…"
      @retry="load"
    >
      <template #empty>
        <EmptyState
          icon="bell"
          title="通知不存在或已被删除"
          description="它可能已被管理员撤回，或者链接已经失效"
        >
          <BaseButton variant="secondary" @click="router.back()">返回上一页</BaseButton>
        </EmptyState>
      </template>

      <div class="detail-content">
        <div class="tags">
          <BaseBadge
            v-if="notice.priority > 0"
            :variant="notice.priority >= 2 ? 'danger' : 'warning'"
          >
            <AppIcon :name="notice.priority >= 2 ? 'alert-triangle' : 'alert-circle'" :size="11" />
            {{ notice.priority >= 2 ? '紧急' : '重要' }}
          </BaseBadge>
          <BaseBadge v-if="notice.is_todo" variant="info">
            <AppIcon name="clipboard" :size="11" />
            待办
          </BaseBadge>
          <span class="meta">
            {{ notice.creator_name || '' }} ·
            {{ notice.created_at ? new Date(notice.created_at).toLocaleDateString('zh-CN') : '' }}
          </span>
        </div>

        <h2>{{ notice.title }}</h2>

        <div class="body" v-html="safeContent"></div>

        <!-- 待办操作 -->
        <div v-if="notice.is_todo" class="todo-section">
          <BaseButton
            v-if="!notice.is_completed"
            variant="primary"
            block
            :loading="completing"
            @click="handleComplete"
          >
            <AppIcon v-if="!completing" name="check-circle" :size="18" />
            标记完成
          </BaseButton>
          <div v-else class="completed-badge">
            <AppIcon name="check-circle" :size="16" />
            你已完成
          </div>
        </div>

        <!-- 管理员：完成情况 -->
        <div v-if="userStore.isAdmin && completion" class="completion-section">
          <h3>完成情况 ({{ completion.completed?.length || 0 }}/{{ completion.total }})</h3>
          <div v-if="completion.completed?.length" class="done-list">
            <span v-for="u in completion.completed" :key="u.id" class="done-user">
              <AppIcon name="check" :size="11" />
              {{ u.name }}
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
    </StateView>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; background: var(--color-bg); }
.detail-content { padding: 20px 16px; }
.tags { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.meta { font-size: var(--font-size-xs); color: var(--color-text-2); }
h2 { font-size: var(--font-size-title); font-weight: 700; line-height: 1.3; margin-bottom: 16px; color: var(--color-text); }
.body { font-size: var(--font-size-md); line-height: 1.8; color: var(--color-text-2); }
.body :deep(p) { margin-bottom: 10px; }
.body :deep(img) { max-width: 100%; border-radius: var(--radius-sm); margin: 12px 0; }

/* 待办操作 */
.todo-section { margin-top: 24px; }
.completed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  background: var(--color-success-bg);
  color: var(--color-success);
  font-size: var(--font-size-md);
  font-weight: 600;
}

/* 完成情况 */
.completion-section {
  margin-top: 24px; padding: 16px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
}
.completion-section h3 {
  font-size: var(--font-size-body); font-weight: 600; color: var(--color-text);
  margin-bottom: 12px;
}
.done-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.done-user {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--font-size-xs); padding: 4px 8px; border-radius: var(--radius-sm);
  background: var(--color-success-bg); color: var(--color-success);
}
.pending-label {
  font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-2); margin-bottom: 6px;
}
.pending-list { display: flex; flex-wrap: wrap; gap: 6px; }
.pending-user {
  font-size: var(--font-size-xs); padding: 4px 8px; border-radius: var(--radius-sm);
  background: var(--color-surface-2); color: var(--color-text-2);
}
</style>
