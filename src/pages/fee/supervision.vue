<template>
  <view class="supervision-page">
    <custom-nav-bar title="财务监督" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <!-- Overview -->
      <view class="overview-card">
        <view class="overview-header">
          <text class="overview-title">财务概况</text>
          <text class="update-time">更新于 {{ updateTime }}</text>
        </view>
        <view class="overview-grid">
          <view class="overview-item">
            <text class="overview-value">¥{{ totalBalance }}</text>
            <text class="overview-label">当前余额</text>
          </view>
          <view class="overview-item">
            <text class="overview-value">{{ memberCount }}人</text>
            <text class="overview-label">在册人数</text>
          </view>
          <view class="overview-item">
            <text class="overview-value">{{ transactionCount }}笔</text>
            <text class="overview-label">交易记录</text>
          </view>
        </view>
      </view>

      <!-- Recent Transactions -->
      <view class="section-block">
        <text class="block-title">最近交易</text>
        <view class="trans-list">
          <view v-for="t in transactions" :key="t.id" class="trans-item">
            <view :class="['trans-dot', t.type]"></view>
            <view class="trans-info">
              <text class="trans-title">{{ t.title }}</text>
              <text class="trans-meta">{{ t.handler }} · {{ t.time }}</text>
            </view>
            <text :class="['trans-amount', t.type]">{{ t.type === 'in' ? '+' : '-' }}¥{{ t.amount }}</text>
          </view>
        </view>
      </view>

      <!-- Audit Log -->
      <view class="section-block">
        <text class="block-title">审批轨迹</text>
        <view class="audit-list">
          <view v-for="(log, idx) in auditLogs" :key="idx" class="audit-item">
            <view class="audit-step">
              <view class="step-num">{{ idx + 1 }}</view>
              <view class="step-line" v-if="idx < auditLogs.length - 1"></view>
            </view>
            <view class="audit-content">
              <text class="audit-action">{{ log.action }}</text>
              <text class="audit-person">{{ log.person }}</text>
              <text class="audit-time">{{ log.time }}</text>
              <text class="audit-note" v-if="log.note">{{ log.note }}</text>
            </view>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const updateTime = ref('2026-04-09 14:30')
const totalBalance = ref('3,580.00')
const memberCount = ref(32)
const transactionCount = ref(47)

const transactions = ref([
  { id: 1, title: '班费收缴 - 四月', handler: '生活副区', time: '2026-04-09', amount: '1600.00', type: 'in' },
  { id: 2, title: '团建活动支出', handler: '张三', time: '2026-04-08', amount: '680.00', type: 'out' },
  { id: 3, title: '清洁用品采购', handler: '李四', time: '2026-04-05', amount: '186.50', type: 'out' },
  { id: 4, title: '报销 - 学习资料', handler: '王五', time: '2026-03-28', amount: '45.00', type: 'out' }
])

const auditLogs = ref([
  { action: '提交使用申请', person: '李四', time: '2026-04-07 10:20', note: '团建活动经费 ¥680.00' },
  { action: '区队长初审通过', person: '区队长', time: '2026-04-07 15:30', note: '' },
  { action: '投票表决通过 (5/7)', person: '班干部集体', time: '2026-04-08 11:00', note: '同意率71%' },
  { action: '资金划拨完成', person: '生活副区', time: '2026-04-08 16:00', note: '' }
])
</script>

<style lang="scss" scoped
>
.supervision-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.overview-card {
  margin: 24rpx 32rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 24rpx;
  padding: 32rpx; overflow: hidden;
}
.overview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28rpx; }
.overview-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: rgba(255,255,255,0.85); }
.update-time { font-size: 22rpx; color: rgba(255,255,255,0.5); }

.overview-grid { display: flex; gap: 0; }
.overview-item { flex: 1; text-align: center; }
.overview-value {
  font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; display: block; margin-bottom: 8rpx;
}
.overview-label { font-size: 22rpx; color: rgba(255,255,255,0.55); }

.section-block { margin: 32rpx 32rpx 0; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.block-title { font-family: 'PingFang SC'; font-size: 26rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 24rpx; }

.trans-list { display: flex; flex-direction: column; gap: 4rpx; }
.trans-item { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; }
.trans-dot {
  width: 10rpx; height: 10rpx; border-radius: 50%; flex-shrink: 0;
  &.in { background: #a7c8ff; }
  &.out { background: #ffb4ab; }
}
.trans-info { flex: 1; min-width: 0; }
.trans-title { font-size: 26rpx; color: #191c1e; font-weight: 500; display: block; }
.trans-meta { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.trans-amount {
  font-family: 'PingFang SC'; font-size: 27rpx; font-weight: 600; flex-shrink: 0;
  &.in { color: #a7c8ff; }
  &.out { color: #ffb4ab; }
}

.audit-list { display: flex; flex-direction: column; }
.audit-item { display: flex; gap: 16rpx; padding-bottom: 28rpx;

  &:last-child { padding-bottom: 0; }
}
.audit-step { display: flex; flex-direction: column; align-items: center; width: 36rpx; flex-shrink: 0; }
.step-num {
  width: 36rpx; height: 36rpx; border-radius: 50%; background: #f2f4f7; display: flex; align-items: center;
  justify-content: center; font-size: 20rpx; font-weight: 700; color: #43474f;
}
.step-line { flex: 1; width: 2rpx; background: #e6e8eb; margin-top: 8rpx; }

.audit-content { display: flex; flex-direction: column; gap: 4rpx; padding-top: 2rpx; }
.audit-action { font-size: 26rpx; font-weight: 500; color: #191c1e; }
.audit-person { font-size: 23rpx; color: #43474f; }
.audit-time { font-size: 21rpx; color: #c3c6d1; }
.audit-note { font-size: 23rpx; color: #466270; font-style: italic; }
</style>