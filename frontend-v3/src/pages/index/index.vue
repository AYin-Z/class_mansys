<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { getNotices } from '@/api/notice'
import { getAnnouncements } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const userStore = useUserStore()
const { profile, displayName } = storeToRefs(userStore)
const notices = ref<any[]>([])
const pinnedNotices = computed(() => notices.value.filter(n => n.is_pinned))

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const currentDate = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return `${y}年${m}月${d}日 · ${w}`
})

const pinnedAnnouncements = ref<any[]>([])

onMounted(async () => {
  try {
    const res = await getNotices()
    if (res.success) notices.value = res.notices || []
  } catch (_) {}
  try {
    const res2 = await getAnnouncements()
    if (res2.success) pinnedAnnouncements.value = (res2.announcements || []).filter((a: any) => a.is_pinned)
  } catch (_) {}
})

function goToNotice(id: number) {
  router.push({ path: '/pages/notice/detail', query: { id: String(id) } })
}
function goToAnnouncement(id: number) {
  router.push({ path: '/pages/announcement/detail', query: { id: String(id) } })
}

function goTo(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="home-page">
    <NavBar title="区队管理系统" />

    <!-- 置顶通知 + 公告 -->
    <div v-if="pinnedNotices.length > 0 || pinnedAnnouncements.length > 0" class="pinned-bar">
      <div class="pinned-inner">
        <span class="pinned-icon">📌</span>
        <div class="pinned-scroll">
          <span
            v-for="item in pinnedNotices"
            :key="'n' + item.id"
            class="pinned-item"
            @click="goToNotice(item.id)"
          >
            <span class="pinned-tag">通知</span>{{ item.title }}
          </span>
          <span
            v-for="item in pinnedAnnouncements"
            :key="'a' + item.id"
            class="pinned-item"
            @click="goToAnnouncement(item.id)"
          >
            <span class="pinned-tag type-ann">公告</span>{{ item.title }}
          </span>
        </div>
      </div>
    </div>

    <!-- Hero -->
    <div class="home-hero">
      <div class="avatar-row">
        <div class="avatar">{{ displayName?.charAt(0) || '?' }}</div>
        <div>
          <div class="greeting">{{ greeting }} 👋</div>
          <div class="info">{{ displayName }} · {{ profile?.student_id || '' }}</div>
          <div class="date">{{ currentDate }}</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions — 折叠式 -->
    <div class="quick-header">
      <div class="section-title" style="padding: 0;">⚡ 快捷功能</div>
      <span class="more-btn" @click="goTo('/pages/features/index')">全部功能 ›</span>
    </div>
    <div class="actions-grid">
      <div class="action-item" @click="goTo('/pages/leave/index')"><span class="icon">🏥</span><span class="label">请假</span></div>
      <div class="action-item" @click="goTo('/pages/homework/index')"><span class="icon">📝</span><span class="label">作业</span></div>
      <div class="action-item" @click="goTo('/pages/notice/index')"><span class="icon">📢</span><span class="label">通知</span></div>
      <div class="action-item" @click="goTo('/pages/announcement/index')"><span class="icon">📋</span><span class="label">公告</span></div>
      <div class="action-item" @click="goTo('/pages/fee/index')"><span class="icon">💰</span><span class="label">班费</span></div>
      <div class="action-item" @click="goTo('/pages/fee/expense-apply')"><span class="icon">🧾</span><span class="label">报销</span></div>
      <div class="action-item" @click="goTo('/pages/album/index')"><span class="icon">🖼️</span><span class="label">相册</span></div>
      <div class="action-item" @click="goTo('/pages/features/index')"><span class="icon">📱</span><span class="label">更多</span></div>
    </div>

    <!-- Latest Notices -->
    <div class="section-title">📋 最新通知</div>
    <div v-if="notices.length === 0" class="empty-state">暂无通知</div>
    <div
      v-for="item in notices"
      :key="item.id"
      class="notice-item"
      @click="goToNotice(item.id)"
    >
      <div class="tag" :class="item.priority > 0 ? 'important' : item.is_todo ? 'todo' : 'normal'"></div>
      <div class="body">
        <div class="title">{{ item.title }}</div>
        <div class="preview">{{ item.content?.replace(/<[^>]*>/g, '').slice(0, 60) || '' }}</div>
        <div class="meta">
          <span>{{ item.creator_name || '' }}</span>
          <span>{{ item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page { padding-bottom: 80px; }

/* 置顶栏 */
.pinned-bar {
  background: linear-gradient(135deg, #fff7ed, #fef3c7);
  border-bottom: 1px solid #fde68a;
  overflow: hidden;
}
.pinned-inner {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; max-width: 100%;
}
.pinned-icon { font-size: 14px; flex-shrink: 0; }
.pinned-scroll {
  flex: 1; overflow-x: auto; white-space: nowrap;
  font-size: 13px; font-weight: 500; color: #92400e;
  -webkit-overflow-scrolling: touch;
}
.pinned-scroll::-webkit-scrollbar { display: none; }
.pinned-item { cursor: pointer; margin-right: 12px; }
.pinned-item:active { opacity: 0.7; }
.pinned-tag { font-size: 10px; padding: 1px 5px; border-radius: 3px; margin-right: 4px; background: #fcd34d; color: #78350f; }
.pinned-tag.type-ann { background: #bfdbfe; color: #1e40af; }

.home-hero {
  background: linear-gradient(135deg, var(--color-hero-from), var(--color-hero-to));
  padding: 24px 20px 28px;
  color: #fff;
  transition: background 0.3s;
}
.avatar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
.avatar {
  width: 46px; height: 46px; border-radius: 50%;
  background: rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  border: 2px solid rgba(255,255,255,0.2);
  flex-shrink: 0;
}
.greeting { font-size: 20px; font-weight: 700; }
.info { font-size: 13px; opacity: 0.8; margin-top: 2px; }
.date { font-size: 12px; opacity: 0.6; margin-top: 4px; }

/* Quick Actions */
.quick-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 12px;
}
.more-btn {
  font-size: 12px;
  color: var(--color-accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-accent-bg);
  font-weight: 500;
  -webkit-tap-highlight-color: transparent;
}
.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 0 12px;
}
@media (min-width: 480px) { .actions-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 768px) { .actions-grid { grid-template-columns: repeat(8, 1fr); } }
.action-item {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 16px 8px;
  text-align: center;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: all 0.15s, background 0.3s;
  -webkit-tap-highlight-color: transparent;
}
.action-item:active {
  transform: scale(0.95);
  background: var(--color-surface-hover);
}
.action-item .icon { font-size: 22px; margin-bottom: 6px; display: block; }
.action-item .label { font-size: 11px; color: var(--color-text-2); font-weight: 500; }

/* Notice Items */
.notice-item {
  background: var(--color-surface);
  margin: 0 12px 8px;
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
  display: flex;
  gap: 12px;
  cursor: pointer;
  transition: background 0.3s;
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
.title { font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 3px; }
.preview { font-size: 13px; color: var(--color-text-2); line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 11px; color: var(--color-text-3); margin-top: 8px; display: flex; gap: 12px; }

.empty-state {
  text-align: center;
  padding: 32px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}
</style>
