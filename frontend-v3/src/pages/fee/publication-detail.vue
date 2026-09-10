<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getPublicationDetail } from '@/api/fee'
import type { FeePublication } from '@/api/fee'
import NavBar from '@/components/ui/NavBar.vue'

const route = useRoute()
const pub = ref<FeePublication | null>(null)
const loading = ref(true)

onMounted(async () => {
  const id = Number(route.query.id)
  if (!id) return
  try {
    const res = await getPublicationDetail(id)
    if (res.success) pub.value = res.publication || (res as any).data?.publication
  } catch (_) {}
  finally { loading.value = false }
})
</script>

<template>
  <div class="page">
    <NavBar title="公示详情" show-back />
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="!pub" class="empty-state">公示不存在</div>
    <template v-else>
      <div class="card">
        <h2>{{ pub.title }}</h2>
        <p class="period">{{ pub.period }}</p>
        <div class="summary-row">
          <div class="sum-item"><span class="label">收入</span><span class="val green">+¥{{ Number(pub.total_income).toFixed(2) }}</span></div>
          <div class="sum-item"><span class="label">支出</span><span class="val red">-¥{{ Number(pub.total_expense).toFixed(2) }}</span></div>
          <div class="sum-item"><span class="label">结余</span><span class="val">¥{{ Number(pub.balance).toFixed(2) }}</span></div>
        </div>
        <div v-if="pub.details_json" class="details-json">
          <pre>{{ JSON.stringify(pub.details_json, null, 2) }}</pre>
        </div>
        <p class="footer">发布者：{{ pub.publisher_name || pub.published_by }} · {{ (pub.published_at || '').slice(0, 10) }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.card { margin: 16px 12px; padding: 20px; border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-card); }
.card h2 { font-size: 18px; font-weight: 700; color: var(--color-text); margin: 0 0 4px; }
.period { font-size: 13px; color: var(--color-text-3); margin-bottom: 16px; }
.summary-row { display: flex; gap: 12px; margin-bottom: 16px; }
.sum-item { flex: 1; text-align: center; padding: 12px 8px; border-radius: var(--radius-sm); background: var(--color-surface-2); }
.sum-item .label { display: block; font-size: 12px; color: var(--color-text-3); margin-bottom: 4px; }
.sum-item .val { font-size: 18px; font-weight: 700; color: var(--color-text); }
.sum-item .val.green { color: #16a34a; }
.sum-item .val.red { color: var(--color-error); }
.details-json { margin-top: 12px; padding: 12px; background: var(--color-surface-2); border-radius: var(--radius-sm); overflow-x: auto; }
.details-json pre { font-size: 12px; color: var(--color-text-2); margin: 0; white-space: pre-wrap; }
.footer { font-size: 12px; color: var(--color-text-3); margin-top: 16px; text-align: right; }
</style>
