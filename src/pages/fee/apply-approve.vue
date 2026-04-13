<template>
  <view class="approve-page">
    <custom-nav-bar title="申请审核" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="filter-tabs">
        <view :class="['tab', { active: currentTab === 'pending' }]" @tap="currentTab = 'pending'">
          <text class="tab-text">待审核</text>
          <text class="tab-count">{{ pendingList.length }}</text>
        </view>
        <view :class="['tab', { active: currentTab === 'done' }]" @tap="currentTab = 'done'">
          <text class="tab-text">已处理</text>
        </view>
      </view>

      <view class="app-list">
        <view v-for="item in displayList" :key="item.id" class="app-card">
          <view class="card-accent" :class="item.amount >= 100 ? 'medium' : 'small'"></view>
          <view class="card-body">
            <view class="card-top">
              <text class="app-title">{{ item.purpose }}</text>
              <text class="app-amount">¥{{ item.amount }}</text>
            </view>
            <text class="app-detail">{{ item.details }}</text>
            <view class="meta-row">
              <text class="meta-text">申请人：{{ item.applicant }}</text>
              <text class="meta-text">{{ item.time }}</text>
            </view>

            <view class="action-area" v-if="currentTab === 'pending' && !item.processed">
              <button class="action-btn reject" @click="reject(item)">驳回</button>
              <button class="action-btn approve" @click="approve(item)">通过初审</button>
            </view>

            <view class="result-tag" v-else-if="item.processed">
              <text :class="['result-text', item.approved ? 'yes' : 'no']">
                {{ item.approved ? '✓ 已通过' : '✗ 已驳回' }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const currentTab = ref('pending')

const pendingList = ref([
  { id: 1, purpose: '购买班级清洁用品', amount: '186.50', details: '拖把×3、扫把×5、垃圾袋若干', applicant: '张三', time: '2026-04-09', processed: false },
  { id: 2, purpose: '团建活动经费', amount: '680.00', details: '聚餐+活动物料', applicant: '李四', time: '2026-04-08', processed: false },
  { id: 3, purpose: '打印学习资料', amount: '45.00', details: '复习资料打印30份', applicant: '王五', time: '2026-04-07', processed: true, approved: true }
])

const doneList = ref([
  { id: 4, purpose: '购买体育器材', amount: '320.00', details: '篮球×2、羽毛球拍×4', applicant: '赵六', time: '2026-04-05', processed: true, approved: true }
])

const displayList = computed(() => currentTab.value === 'pending' ? pendingList.value : doneList.value)

function approve(item) {
  uni.showModal({ title: '确认通过', content: `确定通过「${item.purpose}」的初审？`, success: (res) => {
    if (res.confirm) { item.processed = true; item.approved = true; uni.showToast({ title: '已通过，进入投票阶段', icon: 'success' }) }
  }})
}

function reject(item) {
  uni.showModal({ title: '确认驳回', content: `确定驳回「${item.purpose}」？`, success: (res) => {
    if (res.confirm) { item.processed = true; item.approved = false; uni.showToast({ title: '已驳回', icon: 'none' }) }
  }})
}
</script>

<style lang="scss" scoped>
.approve-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.filter-tabs { display: flex; gap: 16rpx; padding: 20rpx 32rpx; background: #fff; }
.tab {
  flex: 1; height: 72rpx; border-radius: 36rpx; display: flex; align-items: center;
  justify-content: center; gap: 8rpx; background: #f2f4f7;
  &.active { background: #001e40; .tab-text { color: #fff; } .tab-count { background: rgba(255,255,255,0.2); color: #fff; } }
}
.tab-text { font-size: 26rpx; font-weight: 500; color: #43474f; }
.tab-count {
  padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  background: rgba(0,30,64,0.06); color: #001e40;
}

.app-list { padding: 24rpx 32rpx; }

.app-card { position: relative; display: flex; background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 16rpx; }
.card-accent {
  width: 10rpx; flex-shrink: 0;
  &.small { background: #466270; }
  &.medium { background: #001e40; }
}
.card-body { flex: 1; padding: 24rpx; }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; }
.app-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: #191c1e; flex: 1; }
.app-amount { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #001e40; }
.app-detail { font-size: 24rpx; color: #43474f; margin-bottom: 16rpx; display: block; line-height: 1.5; }
.meta-row { display: flex; gap: 24rpx; margin-bottom: 20rpx; }
.meta-text { font-size: 22rpx; color: #c3c6d1; }

.action-area { display: flex; gap: 12rpx; }
.action-btn {
  flex: 1; height: 72rpx; border-radius: 14rpx; border: none; font-size: 26rpx; font-weight: 600;
  &.reject { background: #f2f4f7; color: #460002; }
  &.approve { background: linear-gradient(135deg, #001e40, #003366); color: #fff; }
}
.result-tag { text-align: center; padding-top: 8rpx; }
.result-text { font-size: 26rpx; font-weight: 600; &.yes { color: #003366; } &.no { color: #460002; } }
</style>