<template>
  <div class="collection-page">
    <custom-nav-bar title="班费收缴" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="summary-card" v-if="currentCollection">
        <div class="accent-bar"></div>
        <div class="summary-content">
          <span class="summary-title">{{ currentCollection.title }}</span>
          <div class="amount-row">
            <span class="currency">¥</span>
            <span class="amount">{{ currentCollection.amount_per_person }}</span>
            <span class="per-person">/人</span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <span class="progress-text">{{ currentCollection.paid_count }}/{{ currentCollection.total_count }}人已缴纳</span>
          </div>
        </div>
      </div>

      <div class="section-header">
        <span class="section-title">缴纳状态</span>
        <div class="header-actions">
          <button class="action-btn" v-if="canManage && !currentCollection" @tap="handleCreateCollection">发起收缴</button>
          <button class="action-btn" v-if="canManage && currentCollection && !currentCollection.closed_at" @tap="handleClose">截止收缴</button>
          <button class="refresh-btn" @tap="loadCollections">刷新</button>
        </div>
      </div>

      <div class="member-list">
        <div v-for="m in memberRecords" :key="m.user_id" class="member-card">
          <div class="avatar-box" :style="{ background: m.paid_at ? 'linear-gradient(135deg, #001e40, #003366)' : '#f2f4f7' }">
            <span class="avatar-text" :class="{ dim: !m.paid_at }">{{ (m.name || '?').charAt(0) }}</span>
          </div>
          <div class="member-info">
            <span class="member-name">{{ m.name || '未知' }}</span>
            <span class="member-id">{{ m.student_id || '' }}</span>
          </div>
          <div :class="['status-tag', m.paid_at ? 'paid' : 'unpaid']">
            {{ m.paid_at ? '已缴纳' : (m.is_exempt ? '免缴' : '未缴纳') }}
          </div>
          <div class="member-actions" v-if="!m.paid_at && !m.is_exempt">
            <button class="pay-btn" @tap="handlePay(m)">缴纳</button>
            <button class="exempt-btn" v-if="canManage" @tap="handleExempt(m)">免缴</button>
          </div>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onMounted, ref } from 'vue'
import { getCollections, getCollectionDetail, getCollectionRecords, createCollection, payCollection, exemptCollection, closeCollection } from '@/api/fee'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/ui'
const userStore = useUserStore()
const currentCollection = ref(null)
const memberRecords = ref([])

const canManage = computed(() => userStore.role >= 1)

const progressPercent = computed(() => {
  if (!currentCollection.value || !currentCollection.value.total_count) return 0
  return Math.round((currentCollection.value.paid_count || 0) / currentCollection.value.total_count * 100)
})

async function loadCollections() {
  showToast('加载中...')
  try {
    const res = await getCollections()
    if (res.success && res.collections.length > 0) {
      const latest = res.collections[0]
      const detail = await getCollectionDetail(latest.id)
      if (detail.success) currentCollection.value = detail.collection

      const records = await getCollectionRecords(latest.id)
      if (records.success) memberRecords.value = records.records
    } else {
      currentCollection.value = null
      memberRecords.value = []
    }
  } catch (err) {
    showToast('加载失败')
  } finally {
    
  }
}

onMounted(loadCollections)

/** 金额校验：必须为正数且不超过 100,000 */
function validateAmount(amountStr) {
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) {
    showToast('金额必须为正数')
    return null
  }
  if (amount > 100000) {
    showToast('金额不能超过 100,000 元')
    return null
  }
  return amount
}

/** 计算当前学期（用于创建收缴批次） */
function deriveSemester() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  if (m >= 2 && m <= 7) return `${y}-${y + 1}-1`  // 春季学期
  return `${y}-${y + 1}-2`                          // 秋季学期
}

/** 发起收缴（管理员） */
async function handleCreateCollection() {
  const titleRes = await showConfirm('', '请输入收缴标题：')
  if (!titleRes?.confirm || !titleRes.content?.trim()) return

  const amountRes = await showConfirm('', '请输入每人应缴金额（元）：')
  if (!amountRes?.confirm) return

  const amount = validateAmount(amountRes.content)
  if (amount === null) return

  showToast('发起中...')
  try {
    const res = await createCollection({
      title: titleRes.content.trim(),
      amount_per_person: amount,
      semester: deriveSemester()
    })
    if (res.success) {
      showToast('收缴已发起')
      await loadCollections()
    } else {
      showToast(res.message || '发起失败', 'error')
    }
  } catch (e) {
    showToast('发起失败')
  } finally {
    
  }
}

/** 缴纳班费（所有人均可操作） */
async function handlePay(record) {
  const defaultAmount = currentCollection.value?.amount_per_person ?? ''
  const res = await uni.showModal({
    title: '缴纳班费',
    content: `为 ${record.name} 缴纳班费，金额（元）：`,
    editable: true,
    placeholderText: String(defaultAmount)
  })
  if (!res?.confirm) return

  const amountStr = res.content?.trim() || String(defaultAmount)
  const amount = validateAmount(amountStr)
  if (amount === null) return

  showToast('缴纳中...')
  try {
    const result = await payCollection(currentCollection.value.id, amount)
    if (result.success) {
      showToast('缴纳成功')
      await loadCollections()
    } else {
      showToast(result.message || '缴纳失败', 'error')
    }
  } catch (e) {
    showToast('缴纳失败')
  } finally {
    
  }
}

/** 标记免缴（管理员） */
async function handleExempt(record) {
  const res = await uni.showModal({
    title: '标记免缴',
    content: `确定将 ${record.name} 标记为免缴？填写备注：`,
    editable: true,
    placeholderText: '免缴原因（选填）'
  })
  if (!res?.confirm) return

  showToast('处理中...')
  try {
    const result = await exemptCollection(currentCollection.value.id, record.user_id, res.content || '')
    if (result.success) {
      showToast('已标记免缴')
      await loadCollections()
    } else {
      showToast(result.message || '操作失败', 'error')
    }
  } catch (e) {
    showToast('操作失败')
  } finally {
    
  }
}

/** 截止收缴（管理员） */
async function handleClose() {
  const res = await showConfirm('', '确定截止本次收缴？截止后不可再缴纳。')
  if (!res?.confirm) return

  showToast('处理中...')
  try {
    const result = await closeCollection(currentCollection.value.id)
    if (result.success) {
      showToast('已截止')
      await loadCollections()
    } else {
      showToast(result.message || '操作失败', 'error')
    }
  } catch (e) {
    showToast('操作失败')
  } finally {
    
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.collection-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.summary-card { position: relative; margin: 24rpx 32rpx; background: #ffffff; border-radius: 20rpx; overflow: hidden; }
.accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 10rpx; background: linear-gradient(180deg, #001e40, #003366); }
.summary-content { padding: 32rpx 28rpx 28rpx 24rpx; }
.summary-title { font-size: 24rpx; color: #c3c6d1; font-weight: 500; display: block; margin-bottom: 12rpx; }
.amount-row { display: flex; align-items: baseline; gap: 6rpx; margin-bottom: 24rpx; }
.currency { font-size: 32rpx; font-weight: 700; color: #191c1e; }
.amount { font-family: 'PingFang SC', sans-serif; font-size: 56rpx; font-weight: 700; color: #191c1e; }
.per-person { font-size: 26rpx; color: #c3c6d1; }
.progress-wrap { display: flex; flex-direction: column; gap: 10rpx; }
.progress-bar { height: 12rpx; background: #f2f4f7; border-radius: 6rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 6rpx; transition: width 0.3s; }
.progress-text { font-size: 22rpx; color: #c3c6d1; }

.section-header { display: flex; align-items: center; justify-content: space-between; padding: 0 32rpx; margin-bottom: 20rpx; margin-top: 32rpx; }
.section-title { font-family: 'PingFang SC', sans-serif; font-size: 30rpx; font-weight: 600; color: #191c1e; }
.header-actions { display: flex; align-items: center; gap: 16rpx; }
.action-btn { font-size: 22rpx; color: #001e40; background: rgba(0,30,64,0.06); border: 1rpx solid #001e40; border-radius: 12rpx; padding: 6rpx 20rpx; &::after { display: none; } }
.refresh-btn { font-size: 24rpx; color: #001e40; background: transparent; border: none; padding: 0; &::after { display: none; } }

.member-list { padding: 0 32rpx; }
.member-card { display: flex; align-items: center; gap: 18rpx; padding: 20rpx 0; &:not(:last-child) { border-bottom: 1rpx solid #f2f4f7; } }
.member-actions { display: flex; gap: 12rpx; flex-shrink: 0; }
.pay-btn { font-size: 22rpx; color: #ffffff; background: #001e40; border: none; border-radius: 12rpx; padding: 8rpx 20rpx; &::after { display: none; } }
.exempt-btn { font-size: 22rpx; color: #666; background: #f2f4f7; border: none; border-radius: 12rpx; padding: 8rpx 20rpx; &::after { display: none; } }
.avatar-box { width: 72rpx; height: 72rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.avatar-text { font-size: 28rpx; font-weight: 700; color: #ffffff; &.dim { color: #c3c6d1; } }
.member-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.member-name { font-size: 28rpx; font-weight: 600; color: #191c1e; }
.member-id { font-size: 22rpx; color: #c3c6d1; }
.status-tag { padding: 8rpx 20rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600; &.paid { background: rgba(0,30,64,0.06); color: #001e40; } &.unpaid { background: rgba(70,0,2,0.06); color: #460002; } }
</style>
