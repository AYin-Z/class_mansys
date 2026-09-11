<script setup lang="ts">
/**
 * 公告详情
 *
 * 2026-09 体验修复：
 *  - 加载失败 → StateView 错误态 + 重试（原来吞掉后显示「公告不存在」）；
 *  - 删除底部 80px 手写避让（App.vue 已统一预留 TabBar 高度）。
 */
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAnnouncementDetail } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { sanitizeHtml } from '@/utils/sanitize'

const route = useRoute()
const router = useRouter()
const item = ref<any>(null)
const loading = ref(true)
const error = ref<unknown>(null)
const safeContent = computed(() => sanitizeHtml(item.value?.content || ''))

async function load() {
  loading.value = true
  error.value = null
  try {
    const id = Number(route.query.id)
    if (!id) {
      item.value = null
      return
    }
    const res = await getAnnouncementDetail(id)
    if (res.success) item.value = res.announcement
  } catch (e) {
    error.value = e
    item.value = null
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="detail-page">
    <NavBar title="公告详情" show-back @back="router.back()" />

    <StateView
      :loading="loading"
      :error="error"
      :empty="!item"
      loading-text="正在加载公告…"
      @retry="load"
    >
      <template #empty>
        <EmptyState
          icon="megaphone"
          title="公告不存在或已被删除"
          description="它可能已被管理员撤回，或者链接已经失效"
        >
          <BaseButton variant="secondary" @click="router.back()">返回上一页</BaseButton>
        </EmptyState>
      </template>

      <div class="detail-body">
        <h1 class="title">{{ item.title }}</h1>
        <div class="meta">
          <span>{{ item.creator_name || '' }}</span>
          <span>{{ item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '' }}</span>
        </div>
        <div class="content" v-html="safeContent"></div>
      </div>
    </StateView>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; background: var(--color-bg); }
.detail-body { padding: 16px; }
.title { font-size: var(--font-size-title); font-weight: 700; color: var(--color-text); line-height: 1.4; margin: 0 0 12px; }
.meta { font-size: var(--font-size-xs); color: var(--color-text-2); display: flex; gap: 16px; margin-bottom: 20px; }
.content { font-size: var(--font-size-md); color: var(--color-text); line-height: 1.8; }
</style>
