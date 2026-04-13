<template>
  <view class="announcement-page">
    <custom-nav-bar title="公告资源" />
    <scroll-view scroll-y class="main-scroll">
      <view class="tab-row">
        <view :class="['tab-item', { active: currentTab === 'notice' }]" @tap="currentTab = 'notice'">
          <text class="tab-text">公告</text>
        </view>
        <view :class="['tab-item', { active: currentTab === 'resource' }]" @tap="currentTab = 'resource'">
          <text class="tab-text">资源共享</text>
        </view>
      </view>

      <!-- Notice Tab -->
      <view v-if="currentTab === 'notice'" class="content-list">
        <view v-for="item in notices" :key="item.id" class="list-card" @tap="goDetail(item)">
          <view class="card-accent"></view>
          <view class="card-body">
            <text class="card-title">{{ item.title }}</text>
            <text class="card-summary">{{ item.summary }}</text>
            <view class="card-meta">
              <text class="meta-time">{{ item.time }}</text>
              <text class="meta-author">{{ item.author }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Resource Tab -->
      <view v-else class="resource-grid">
        <view v-for="item in resources" :key="item.id" class="resource-card" @tap="downloadResource(item)">
          <view :class="['file-icon', item.type]">
            <text class="icon-text">{{ fileIcon(item.type) }}</text>
          </view>
          <view class="file-info">
            <text class="file-name">{{ item.name }}</text>
            <text class="file-size">{{ item.size }} · {{ item.uploader }}</text>
          </view>
          <text class="download-icon">↓</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>

    <view class="fab-btn" @tap="goPublish">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const currentTab = ref('notice')

const notices = ref([
  { id: 1, title: '区队规章制度更新', summary: '关于考勤、卫生、纪律等方面的最新规定', time: '2026-04-03', author: '区队长' },
  { id: 2, title: '奖学金评选通知', summary: '本学期奖学金评选工作正式启动，请符合条件的同学准备材料', time: '2026-04-02', author: '辅导员' },
  { id: 3, title: '运动会报名通知', summary: '校运会将于下月举行，请有意参加的同学及时报名', time: '2026-04-01', author: '体育委员' }
])

const resources = ref([
  { id: 1, name: '期末复习资料合集.pdf', type: 'pdf', size: '12.5MB', uploader: '学习副区' },
  { id: 2, name: '课程表2026春季.xlsx', type: 'excel', size: '45KB', uploader: '学习副区' },
  { id: 3, name: '班级通讯录.xlsx', type: 'excel', size: '28KB', uploader: '团支书' },
  { id: 4, name: '区队规章制度.pdf', type: 'pdf', size: '2.1MB', uploader: '区队长' }
])

function fileIcon(type) {
  const map = { pdf: 'PDF', excel: 'XLS', word: 'DOC', image: 'IMG' }
  return map[type] || 'FILE'
}

function goDetail(item) { console.log('查看公告详情', item) }
function downloadResource(item) { uni.showToast({ title: `下载：${item.name}`, icon: 'none' }) }
function goPublish() { uni.navigateTo({ url: '/pages/announcement/publish' }) }
</script>

<style lang="scss" scoped
>
.announcement-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.tab-row { display: flex; gap: 16rpx; padding: 20rpx 32rpx; background: #fff; }
.tab-item {
  flex: 1; height: 72rpx; border-radius: 36rpx; display: flex; align-items: center; justify-content: center;
  &.active { background: #001e40; .tab-text { color: #fff; } }
}
.tab-text { font-size: 28rpx; font-weight: 500; color: #43474f; }

.content-list { padding: 24rpx 32rpx; }
.list-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 16rpx; &:active { opacity: 0.85; } }
.card-accent { width: 10rpx; background: #001e40; flex-shrink: 0; }
.card-body { flex: 1; padding: 24rpx; }
.card-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 10rpx; }
.card-summary { font-size: 24rpx; color: #43474f; line-height: 1.5; margin-bottom: 14rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-meta { display: flex; gap: 16rpx; }
.meta-time, .meta-author { font-size: 22rpx; color: #c3c6d1; }

.resource-grid { padding: 24rpx 32rpx; display: flex; flex-direction: column; gap: 14rpx; }
.resource-card {
  display: flex; align-items: center; gap: 18rpx; padding: 24rpx;
  background: #fff; border-radius: 18rpx; &:active { opacity: 0.85; }
}
.file-icon {
  width: 80rpx; height: 80rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &.pdf { background: rgba(70,0,2,0.06); .icon-text { color: #460002; } }
  &.excel { background: rgba(0,30,64,0.06); .icon-text { color: #001e40; } }
  &.word { background: rgba(70,98,112,0.08); .icon-text { color: #466270; } }
  &.image { background: rgba(0,51,102,0.05); .icon-text { color: #003366; } }
}
.icon-text { font-size: 22rpx; font-weight: 700; }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 27rpx; font-weight: 500; color: #191c1e; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.download-icon { font-size: 32rpx; color: #001e40; flex-shrink: 0; }

.fab-btn {
  position: fixed; right: 32rpx; bottom: calc(120rpx + env(safe-area-inset-bottom));
  width: 104rpx; height: 104rpx; background: linear-gradient(135deg, #001e40, #003366);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.3); z-index: 99;
  &:active { transform: scale(0.95); }
}
.fab-icon { font-size: 48rpx; color: #fff; line-height: 1; }
</style>