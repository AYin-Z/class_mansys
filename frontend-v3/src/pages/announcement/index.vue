<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAnnouncements, getResources } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const activeTab = ref<'board' | 'resources'>('board')

// 公告板
const announcements = ref<any[]>([])
const loadingBoard = ref(true)

// 公共资源
const resources = ref<any[]>([])
const categories = ref<string[]>([])
const activeCategory = ref('')
const loadingRes = ref(false)

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

onMounted(async () => {
  await Promise.all([
    loadAnnouncements(),
    loadResources()
  ])
})

async function loadAnnouncements() {
  try {
    const res = await getAnnouncements()
    if (res.success) announcements.value = res.announcements || []
  } catch (_) {}
  finally { loadingBoard.value = false }
}

async function loadResources(category?: string) {
  loadingRes.value = true
  try {
    const res = await getResources(category || undefined)
    if (res.success) {
      resources.value = res.resources || []
      const cats = new Set<string>()
      resources.value.forEach((r: any) => { if (r.category) cats.add(r.category) })
      categories.value = Array.from(cats)
    }
  } catch (_) {}
  finally { loadingRes.value = false }
}

function filterByCategory(cat: string) {
  activeCategory.value = activeCategory.value === cat ? '' : cat
  loadResources(activeCategory.value || undefined)
}

function goToDetail(id: number) {
  router.push({ path: '/pages/announcement/detail', query: { id: String(id) } })
}
</script>

<template>
  <div class="announcement-page">
    <NavBar title="公告" />

    <!-- Tabs -->
    <div class="tabs">
      <div :class="['tab', { active: activeTab === 'board' }]" @click="activeTab = 'board'">📋 公告板</div>
      <div :class="['tab', { active: activeTab === 'resources' }]" @click="activeTab = 'resources'">📁 公共资源库</div>
    </div>

    <!-- 公告板 -->
    <template v-if="activeTab === 'board'">
      <div v-if="loadingBoard" class="state-text">加载中...</div>
      <div v-else-if="announcements.length === 0" class="state-text">暂无公告</div>

      <div
        v-for="item in announcements"
        :key="item.id"
        class="card"
        @click="goToDetail(item.id)"
      >
        <div class="card-title">{{ item.title }}</div>
        <div class="card-preview">{{ item.content?.replace(/<[^>]*>/g, '').slice(0, 120) || '' }}</div>
        <div class="card-meta">
          <span>{{ item.creator_name || '' }}</span>
          <span>{{ item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '' }}</span>
        </div>
      </div>
    </template>

    <!-- 公共资源库 -->
    <template v-if="activeTab === 'resources'">
      <div v-if="categories.length > 0" class="category-bar">
        <div
          v-for="cat in ['全部', ...categories]"
          :key="cat"
          :class="['chip', { active: (cat === '全部' && !activeCategory) || cat === activeCategory }]"
          @click="filterByCategory(cat === '全部' ? '' : cat)"
        >{{ cat }}</div>
      </div>

      <div v-if="loadingRes" class="state-text">加载中...</div>
      <div v-else-if="resources.length === 0" class="state-text">暂无资源</div>

      <div
        v-for="item in resources"
        :key="item.id"
        class="resource-card"
      >
        <div class="res-icon">📄</div>
        <div class="res-body">
          <div class="res-name">{{ item.name }}</div>
          <div class="res-meta">
            <span>{{ item.category || '未分类' }}</span>
            <span>{{ formatSize(item.size) }}</span>
          </div>
        </div>
        <a v-if="item.url" :href="item.url" target="_blank" class="res-dl" @click.stop>下载</a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.announcement-page { padding-bottom: 24px; }

.state-text { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

/* Tabs */
.tabs {
  display: flex; margin: 0 12px 12px; gap: 0;
  background: var(--color-surface); border-radius: var(--radius-md);
  overflow: hidden;
}
.tab {
  flex: 1; text-align: center; padding: 12px 8px;
  font-size: 14px; font-weight: 500; color: var(--color-text-2);
  cursor: pointer; transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.tab.active { color: var(--color-accent); background: var(--color-accent-bg); font-weight: 600; }

/* Category chips */
.category-bar {
  display: flex; gap: 8px; overflow-x: auto;
  padding: 0 12px 12px; -webkit-overflow-scrolling: touch;
}
.chip {
  flex-shrink: 0; padding: 6px 14px; border-radius: 20px;
  font-size: 12px; font-weight: 500; color: var(--color-text-2);
  background: var(--color-surface); cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.chip.active { background: var(--color-accent); color: #fff; }

/* Cards */
.card {
  background: var(--color-surface); margin: 0 12px 10px;
  border-radius: var(--radius-md); padding: 16px;
  box-shadow: var(--shadow-card); cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.card:active { background: var(--color-surface-hover); }
.card-title { font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.card-preview { font-size: 13px; color: var(--color-text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-meta { font-size: 11px; color: var(--color-text-3); margin-top: 10px; display: flex; gap: 12px; }

/* Resource cards */
.resource-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--color-surface); margin: 0 12px 8px;
  border-radius: var(--radius-md); padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.res-icon { font-size: 24px; flex-shrink: 0; }
.res-body { flex: 1; min-width: 0; }
.res-name { font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.res-meta { font-size: 11px; color: var(--color-text-3); margin-top: 4px; display: flex; gap: 12px; }
.res-dl {
  flex-shrink: 0; padding: 6px 14px; border-radius: var(--radius-sm);
  background: var(--color-accent); color: #fff;
  font-size: 12px; font-weight: 500; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
</style>
