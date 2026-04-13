<template>
  <view class="publication-page">
    <custom-nav-bar title="报销公示" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="pub-list">
        <view v-for="item in publications" :key="item.id" class="pub-card">
          <view class="card-accent"></view>
          <view class="card-body">
            <view class="card-header">
              <text class="pub-title">{{ item.title }}</text>
              <view :class="['status-badge', item.status]">{{ statusText(item.status) }}</view>
            </view>
            <view class="detail-grid">
              <view class="detail-cell">
                <text class="cell-label">报销人</text>
                <text class="cell-value">{{ item.person }}</text>
              </view>
              <view class="detail-cell">
                <text class="cell-label">金额</text>
                <text class="cell-value highlight">¥{{ item.amount }}</text>
              </view>
            </view>
            <text class="pub-desc">{{ item.description }}</text>
            <view class="pub-footer">
              <text class="pub-time">公示时间：{{ item.time }}</text>
              <button class="verify-btn" v-if="item.status === 'pending'" @click="verify(item)">确认</button>
            </view>
          </view>
        </view>

        <view v-if="publications.length === 0" class="empty-state">
          <text class="empty-text">暂无报销公示</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const publications = ref([
  { id: 1, title: '团建活动经费报销', person: '李四', amount: '680.00', description: '本周末班级团建聚餐及活动物料费用明细', time: '2026-04-09 10:00', status: 'pending' },
  { id: 2, title: '清洁用品采购报销', person: '张三', amount: '186.50', description: '拖把×3、扫把×5、垃圾袋若干等清洁用品', time: '2026-04-05 14:20', status: 'confirmed' },
  { id: 3, title: '学习资料打印报销', person: '王五', amount: '45.00', description: '期末复习资料打印30份', time: '2026-03-28 11:30', status: 'confirmed' }
])

function statusText(s) {
  if (s === 'pending') return '待确认'
  return '已确认'
}

function verify(item) {
  uni.showModal({
    title: '确认无误',
    content: `确认「${item.title}」的报销信息无误？`,
    success: (res) => {
      if (res.confirm) { item.status = 'confirmed'; uni.showToast({ title: '已确认', icon: 'success' }) }
    }
  })
}
</script>

<style lang="scss" scoped>
.publication-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.pub-list { padding: 24rpx 32rpx; }

.pub-card { position: relative; display: flex; background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 16rpx; }
.card-accent { width: 10rpx; background: #001e40; flex-shrink: 0; }
.card-body { flex: 1; padding: 24rpx; }

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.pub-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: #191c1e; flex: 1; }
.status-badge {
  padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.pending { background: rgba(70,98,112,0.08); color: #466270; }
  &.confirmed { background: rgba(0,30,64,0.06); color: #001e40; }
}

.detail-grid { display: flex; gap: 32rpx; margin-bottom: 16rpx; }
.detail-cell { display: flex; flex-direction: column; gap: 4rpx; }
.cell-label { font-size: 22rpx; color: #c3c6d1; }
.cell-value { font-size: 26rpx; font-weight: 500; color: #191c1e; &.highlight { color: #001e40; font-weight: 700; } }

.pub-desc { font-size: 24rpx; color: #43474f; line-height: 1.5; margin-bottom: 16rpx; display: block; }

.pub-footer { display: flex; align-items: center; justify-content: space-between; }
.pub-time { font-size: 22rpx; color: #c3c6d1; }
.verify-btn {
  padding: 8rpx 28rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 12rpx;
  border: none; font-size: 24rpx; font-weight: 600; color: #fff;
  &::after { display: none; }
}

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>