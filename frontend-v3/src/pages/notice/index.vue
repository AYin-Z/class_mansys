<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getNotices } from '@/api/notice'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const notices = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await getNotices()
    if (res.success) notices.value = res.notices || []
  } catch (_) {}
  finally { loading.value = false }
})

function goToDetail(id: number) {
  router.push({ path: '/pages/notice/detail', query: { id: String(id) } })
}
</script>

<template>
  <div class="notice-page">
    <NavBar title="通知中心" show-back />

    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="notices.length === 0" class="empty-state">暂无通知</div>

    <div
      v-for="item in notices"
      :key="item.id"
      class="notice-item"
      @click="goToDetail(item.id)"
    >
      <div class="tag" :class="item.priority > 0 ? 'important' : item.is_todo ? 'todo' : 'normal'"></div>
      <div class="body">
        <div class="title">{{ item.title }}</div>
        <div class="preview">{{ item.content?.replace(/<[^>]*>/g, '').slice(0, 80) || '' }}</div>
        <div class="meta">
          <span>{{ item.creator_name || '' }}</span>
          <span>{{ item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-page { padding-bottom: 80px; }
.loading-state, .empty-state {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}
.notice-item {
  background: var(--color-surface);
  margin: 0 12px 8px;
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
  display: flex;
  gap: 12px;
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.notice-item:active { background: var(--color-surface-hover); }
.tag {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}
.tag.important { background: var(--color-error); }
.tag.normal { background: var(--color-accent); }
.tag.todo { background: var(--color-warning); }
.body { flex: 1; }
.title { font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 4px; }
.preview { font-size: 13px; color: var(--color-text-2); line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 11px; color: var(--color-text-3); margin-top: 8px; display: flex; gap: 12px; }
</style>
