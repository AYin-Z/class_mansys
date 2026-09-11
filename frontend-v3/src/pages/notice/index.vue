<script setup lang="ts">
/**
 * 通知中心（学员）
 *
 * 2026-09 体验修复：
 *  - 加载失败不再被 `catch (_) {}` 吞成「暂无通知」，改走 StateView 错误态 + 重试；
 *  - 空态给出「标题 + 一句解释」，不再是零信息的「暂无通知」；
 *  - 优先级/待办角标用 BaseBadge + AppIcon，替代纯色条与不可读的 11px 灰字；
 *  - 底部避让交给 App.vue（已统一加 tabbar 高度）。
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getNotices } from '@/api/notice'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const notices = ref<any[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getNotices()
    if (res.success) notices.value = res.notices || []
  } catch (e) {
    // 失败就是失败：以前这里 catch 掉后渲染「暂无通知」，用户会以为区队真的没发通知
    error.value = e
    notices.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)

function goToDetail(id: number) {
  router.push({ path: '/pages/notice/detail', query: { id: String(id) } })
}
</script>

<template>
  <div class="notice-page">
    <NavBar title="通知中心" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="notices.length === 0"
      loading-text="正在加载通知…"
      empty-icon="bell"
      empty-title="本区队还没有发布通知"
      empty-description="有重要事项会在这里第一时间提醒你"
      @retry="load"
    >
      <div
        v-for="item in notices"
        :key="item.id"
        class="notice-item"
        @click="goToDetail(item.id)"
      >
        <div class="body">
          <div class="title-row">
            <div class="title">{{ item.title }}</div>
            <BaseBadge
              v-if="item.priority > 0"
              :variant="item.priority >= 2 ? 'danger' : 'warning'"
            >
              <AppIcon :name="item.priority >= 2 ? 'alert-triangle' : 'alert-circle'" :size="11" />
              {{ item.priority >= 2 ? '紧急' : '重要' }}
            </BaseBadge>
            <BaseBadge v-else-if="item.is_todo" variant="info">
              <AppIcon name="clipboard" :size="11" />
              待办
            </BaseBadge>
          </div>
          <div class="preview">{{ item.content?.replace(/<[^>]*>/g, '').slice(0, 80) || '' }}</div>
          <div class="meta">
            <span>{{ item.creator_name || '' }}</span>
            <span>{{ item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '' }}</span>
          </div>
        </div>
        <AppIcon class="chevron" name="chevron-right" :size="16" />
      </div>
    </StateView>
  </div>
</template>

<style scoped>
.notice-page { min-height: 100vh; background: var(--color-bg); }

.notice-item {
  background: var(--color-surface);
  margin: 0 12px 8px;
  border-radius: var(--radius-md);
  padding: 16px;
  min-height: 44px;
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.notice-item:active { background: var(--color-surface-hover); }
.body { flex: 1; min-width: 0; }
.title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-2);
  margin-top: 8px;
  display: flex;
  gap: 12px;
}
.chevron { color: var(--color-text-3); flex-shrink: 0; }
</style>
