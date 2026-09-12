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
import { getAnnouncementDetail, updateAnnouncement } from '@/api/announcement'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { sanitizeHtml } from '@/utils/sanitize'
import { toastIfNotNotified } from '@/utils/request'
import { showToast } from '@/utils/ui'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const item = ref<any>(null)
const loading = ref(true)
const error = ref<unknown>(null)
const safeContent = computed(() => sanitizeHtml(item.value?.content || ''))

/** 可编辑：超管，或发布者本人且拥有发布公告权限（与后端同一口径） */
const canEdit = computed(() => {
  if (!item.value) return false
  if (userStore.isAdmin && Number(userStore.role) >= 8) return true
  const isAuthor = Number(item.value.creator_id) === Number(userStore.profile?.id)
  return isAuthor && userStore.hasPermission('PUBLISH_ANNOUNCEMENT')
})

// 编辑弹窗
const editOpen = ref(false)
const editForm = ref({ title: '', content: '', is_pinned: false })
const saving = ref(false)
const saveError = ref('')

function openEdit() {
  if (!item.value) return
  editForm.value = {
    title: item.value.title || '',
    content: item.value.content || '',
    is_pinned: !!item.value.is_pinned,
  }
  saveError.value = ''
  editOpen.value = true
}

async function saveEdit() {
  if (saving.value) return
  if (!editForm.value.title.trim()) { saveError.value = '标题不能为空'; return }
  if (!editForm.value.content.trim()) { saveError.value = '内容不能为空'; return }
  saving.value = true
  saveError.value = ''
  try {
    const res = await updateAnnouncement(Number(route.query.id), {
      title: editForm.value.title.trim(),
      content: editForm.value.content,
      is_pinned: editForm.value.is_pinned,
    })
    editOpen.value = false
    showToast(`已保存（${res.message || '新版本已生成'}）`, 'success')
    await load()
  } catch (e) {
    saveError.value = (e as Error)?.message || '保存失败，请稍后重试'
    toastIfNotNotified(e, '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

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
    <NavBar title="公告详情" show-back @back="router.back()">
      <template #right>
        <button v-if="canEdit" class="edit-btn" type="button" aria-label="编辑公告" @click="openEdit">
          <AppIcon name="edit" :size="18" />
        </button>
      </template>
    </NavBar>

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
          <span v-if="item.updated_at && item.updated_at !== item.created_at" class="edited">已编辑</span>
        </div>
        <div class="content" v-html="safeContent"></div>
      </div>
    </StateView>

    <!-- 编辑公告：保存后生成新版本，可在管理后台「修改记录」里查看与回退 -->
    <BaseModal v-model="editOpen" title="编辑公告" max-width="420px" :close-on-overlay="false">
      <div class="edit-form">
        <label class="edit-label">标题</label>
        <input v-model="editForm.title" class="edit-input" placeholder="公告标题" maxlength="120" />
        <label class="edit-label">正文（支持 &lt;h3&gt;、&lt;ul&gt;、&lt;strong&gt; 等简单 HTML）</label>
        <textarea v-model="editForm.content" class="edit-textarea" rows="10" />
        <label class="edit-check">
          <input v-model="editForm.is_pinned" type="checkbox" />
          <span>置顶显示（首页公告卡片）</span>
        </label>
        <p v-if="saveError" class="edit-error">{{ saveError }}</p>
      </div>
      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="editOpen = false">取消</BaseButton>
        <BaseButton :loading="saving" @click="saveEdit">保存</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; background: var(--color-bg); }
.edit-btn {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text); cursor: pointer;
  border-radius: var(--radius-sm);
}
.edit-btn:active { background: var(--color-surface-hover); }
.meta .edited { color: var(--color-warning); }
.edit-form { display: flex; flex-direction: column; gap: 6px; }
.edit-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-2); margin-top: 8px; }
.edit-input, .edit-textarea {
  width: 100%; padding: 10px 12px; box-sizing: border-box;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-surface-2); color: var(--color-text);
  font-size: var(--font-size-body); font-family: inherit;
}
.edit-input { min-height: 44px; }
.edit-textarea { resize: vertical; line-height: 1.55; }
.edit-check { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: var(--font-size-body); color: var(--color-text); }
.edit-error { color: var(--color-error); font-size: var(--font-size-sm); margin: 8px 0 0; }
.detail-body { padding: 16px; }
.title { font-size: var(--font-size-title); font-weight: 700; color: var(--color-text); line-height: 1.4; margin: 0 0 12px; }
.meta { font-size: var(--font-size-xs); color: var(--color-text-2); display: flex; gap: 16px; margin-bottom: 20px; }
.content { font-size: var(--font-size-md); color: var(--color-text); line-height: 1.8; }
</style>
