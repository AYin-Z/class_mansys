<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAlbums } from '@/api/album'
import type { AlbumItem } from '@/api/album'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const albums = ref<AlbumItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await getAlbums()
    if (res.success) albums.value = res.albums || []
  } catch (_) { /* ignore */ }
  finally { loading.value = false }
})

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

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="albums.length === 0" class="state-text">暂无相册</div>

    <div v-else class="album-grid">
      <div
        v-for="item in albums"
        :key="item.id"
        class="album-card"
        @click="goToAlbum(item.id)"
      >
        <div class="album-cover">
          <img
            v-if="item.cover_url"
            :src="item.cover_url"
            :alt="item.name"
            class="cover-img"
          />
          <div v-else class="cover-placeholder">
            <span class="placeholder-icon">📸</span>
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
  </div>
</template>

<style scoped>
.album-page {
  padding-bottom: 80px;
}
.state-text {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}
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
  background: #f0f0f0;
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
}
.placeholder-icon {
  font-size: 40px;
  opacity: 0.5;
}
.photo-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  line-height: 1.6;
  backdrop-filter: blur(2px);
}
.album-info {
  padding: 10px 12px 12px;
}
.album-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.album-desc {
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.album-meta {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 6px;
  display: flex;
  gap: 12px;
}
</style>
