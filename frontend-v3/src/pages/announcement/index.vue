<script setup lang="ts">
/**
 * 公告 + 公共资源
 *
 * 2026-09 体验修复：
 *  - 公告板 / 资源库两个列表各自有 loading / error+retry / empty 三态
 *    （原来 `catch (_) {}` 会把加载失败渲染成「暂无公告」）；
 *  - 分类筛选无结果用 filtered 空态，文案与真空态区分；
 *  - 📋📁📄 emoji 换成 AppIcon；下载入口点击区提到 44px；
 *  - 次要文字不再用 11px + --color-text-3。
 */
import { mediaUrl } from '@/utils/media'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAnnouncements, getResources } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const activeTab = ref<'board' | 'resources'>('board')

// 公告板
const announcements = ref<any[]>([])
const loadingBoard = ref(true)
const errorBoard = ref<unknown>(null)

// 公共资源
const resources = ref<any[]>([])
const categories = ref<string[]>([])
const activeCategory = ref('')
const loadingRes = ref(false)
const errorRes = ref<unknown>(null)

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
  loadingBoard.value = true
  errorBoard.value = null
  try {
    const res = await getAnnouncements()
    if (res.success) announcements.value = res.announcements || []
  } catch (e) {
    errorBoard.value = e
    announcements.value = []
  } finally { loadingBoard.value = false }
}

async function loadResources(category?: string) {
  loadingRes.value = true
  errorRes.value = null
  try {
    const res = await getResources(category || undefined)
    if (res.success) {
      resources.value = res.resources || []
      const cats = new Set<string>()
      resources.value.forEach((r: any) => { if (r.category) cats.add(r.category) })
      categories.value = Array.from(cats)
    }
  } catch (e) {
    errorRes.value = e
    resources.value = []
  } finally { loadingRes.value = false }
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
      <button
        type="button"
        :class="['tab', { active: activeTab === 'board' }]"
        @click="activeTab = 'board'"
      >
        <AppIcon name="clipboard" :size="16" />
        公告板
      </button>
      <button
        type="button"
        :class="['tab', { active: activeTab === 'resources' }]"
        @click="activeTab = 'resources'"
      >
        <AppIcon name="folder" :size="16" />
        公共资源库
      </button>
    </div>

    <!-- 公告板 -->
    <template v-if="activeTab === 'board'">
      <StateView
        :loading="loadingBoard"
        :error="errorBoard"
        :empty="announcements.length === 0"
        loading-text="正在加载公告…"
        empty-icon="megaphone"
        empty-title="公告板还是空的"
        empty-description="区队有通知事项时会发布在这里"
        @retry="loadAnnouncements"
      >
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
      </StateView>
    </template>

    <!-- 公共资源库 -->
    <template v-if="activeTab === 'resources'">
      <div v-if="categories.length > 0" class="category-bar">
        <button
          v-for="cat in ['全部', ...categories]"
          :key="cat"
          type="button"
          :class="['chip', { active: (cat === '全部' && !activeCategory) || cat === activeCategory }]"
          @click="filterByCategory(cat === '全部' ? '' : cat)"
        >{{ cat }}</button>
      </div>

      <StateView
        :loading="loadingRes"
        :error="errorRes"
        :empty="resources.length === 0"
        loading-text="正在加载资源…"
        empty-icon="folder"
        :empty-variant="activeCategory ? 'filtered' : 'default'"
        :empty-title="activeCategory ? '当前分类下没有资源' : '还没有共享资源'"
        :empty-description="activeCategory ? '换个分类看看，或点「全部」查看所有资源' : '干部上传学习资料后会出现在这里'"
        @retry="loadResources(activeCategory || undefined)"
      >
        <div
          v-for="item in resources"
          :key="item.id"
          class="resource-card"
        >
          <span class="res-icon"><AppIcon name="file" :size="22" /></span>
          <div class="res-body">
            <div class="res-name">{{ item.name }}</div>
            <div class="res-meta">
              <span>{{ item.category || '未分类' }}</span>
              <span>{{ formatSize(item.size) }}</span>
            </div>
          </div>
          <a v-if="item.url" :href="mediaUrl(item.url)" target="_blank" rel="noopener" class="res-dl">
            <AppIcon name="download" :size="15" />
            下载
          </a>
        </div>
      </StateView>
    </template>
  </div>
</template>

<style scoped>
.announcement-page { padding-bottom: 24px; }

/* Tabs */
.tabs {
  display: flex; margin: 0 12px 12px; gap: 0;
  background: var(--color-surface); border-radius: var(--radius-md);
  overflow: hidden;
}
.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 12px 8px;
  border: none;
  background: transparent;
  font-size: var(--font-size-body); font-weight: 500; color: var(--color-text-2);
  cursor: pointer; transition: background var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.tab.active { color: var(--color-accent); background: var(--color-accent-bg); font-weight: 600; }

/* Category chips */
.category-bar {
  display: flex; gap: 8px; overflow-x: auto;
  padding: 0 12px 12px; -webkit-overflow-scrolling: touch;
}
.chip {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-height: 44px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs); font-weight: 500; color: var(--color-text-2);
  background: var(--color-surface); cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast);
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
.card-title { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.card-preview { font-size: var(--font-size-sm); color: var(--color-text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-meta { font-size: var(--font-size-xs); color: var(--color-text-2); margin-top: 10px; display: flex; gap: 12px; }

/* Resource cards */
.resource-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--color-surface); margin: 0 12px 8px;
  border-radius: var(--radius-md); padding: 12px 16px;
  box-shadow: var(--shadow-card);
}
.res-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-text-2);
}
.res-body { flex: 1; min-width: 0; }
.res-name { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.res-meta { font-size: var(--font-size-xs); color: var(--color-text-2); margin-top: 4px; display: flex; gap: 12px; }
.res-dl {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 9px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-accent); color: #fff;
  font-size: var(--font-size-sm); font-weight: 600; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
</style>
