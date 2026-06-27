<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAnnouncementDetail } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'
import { sanitizeHtml } from '@/utils/sanitize'

const route = useRoute()
const router = useRouter()
const item = ref<any>(null)
const loading = ref(true)
const safeContent = computed(() => sanitizeHtml(item.value?.content || ''))

onMounted(async () => {
  try {
    const id = Number(route.query.id)
    if (!id) return
    const res = await getAnnouncementDetail(id)
    if (res.success) item.value = res.announcement
  } catch (_) {}
  finally { loading.value = false }
})
</script>

<template>
  <div class="detail-page">
    <NavBar title="公告详情" show-back @back="router.back()" />

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="!item" class="state-text">公告不存在</div>

    <div v-else class="detail-body">
      <h1 class="title">{{ item.title }}</h1>
      <div class="meta">
        <span>{{ item.creator_name || '' }}</span>
        <span>{{ item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '' }}</span>
      </div>
      <div class="content" v-html="safeContent"></div>
    </div>
  </div>
</template>

<style scoped>
.detail-page { padding-bottom: 80px; }
.state-text { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.detail-body { padding: 16px; }
.title { font-size: 20px; font-weight: 700; color: var(--color-text); line-height: 1.4; margin: 0 0 12px; }
.meta { font-size: 12px; color: var(--color-text-3); display: flex; gap: 16px; margin-bottom: 20px; }
.content { font-size: 15px; color: var(--color-text); line-height: 1.8; }
</style>
