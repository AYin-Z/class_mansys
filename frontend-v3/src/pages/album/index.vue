<script setup lang="ts">
/**
 * 区队相册列表
 *
 * 2026-09（体验修复）：
 *  - 加载失败不再被 `catch (_) {}` 吞成「暂无相册」→ error + 重试
 *  - emoji 占位图 📸 → AppIcon；硬编码 #f0f0f0 → 令牌
 *  - 底部避让交给 App.vue，删除手写 padding-bottom: 80px
 */
import { mediaUrl } from '@/utils/media'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAlbums } from '@/api/album'
import type { AlbumItem } from '@/api/album'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const albums = ref<AlbumItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getAlbums()
    if (res.success) albums.value = res.albums || []
    else error.value = new Error('加载相册失败，请稍后重试')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

function goToAlbum(id: number) {
  router.push({ path: '/pages/album/detail', query: { id: String(id) } })
}

function formatDate(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="album-page">
    <NavBar title="区队相册" />

    <StateView
      :loading="loading"
      :error="error"
      :empty="albums.length === 0"
      loading-text="正在加载相册…"
      empty-icon="image"
      empty-title="还没有相册"
      empty-description="相册创建后会显示在这里"
      @retry="load"
    >
      <div class="album-grid">
        <div
          v-for="item in albums"
          :key="item.id"
          class="album-card"
          @click="goToAlbum(item.id)"
        >
          <div class="album-cover">
            <img
              v-if="item.cover_url"
              :src="mediaUrl(item.cover_url)"
              :alt="item.name"
              class="cover-img"
            />
            <div v-else class="cover-placeholder">
              <AppIcon name="image" :size="34" :stroke="1.5" />
            </div>
            <span class="photo-badge">{{ item.photo_count }} 张</span>
          </div>
          <div class="album-info">
            <div class="album-name">{{ item.name }}</div>
            <div v-if="item.description" class="album-desc">{{ item.description }}</div>
            <div class="album-meta">
              <span>{{ item.creator_name || '' }}</span>
              <span>{{ formatDate(item.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </StateView>
  </div>
</template>

<style scoped>
.album-page { min-height: 100vh; }
.album-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
}
.album-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.album-card:active {
  transform: scale(0.97);
  background: var(--color-surface-hover);
}
.album-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-surface-2);
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
}
.photo-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  line-height: 1.6;
  backdrop-filter: blur(2px);
}
.album-info {
  padding: 10px 12px 12px;
}
.album-name {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.album-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.album-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  margin-top: 6px;
  display: flex;
  gap: 12px;
}
</style>
