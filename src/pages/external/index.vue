import { ref } from 'vue'
<template>
  <div class="external-page">
    <custom-nav-bar title="外部系统" />
    <div scroll-y class="main-scroll">
      <div class="sys-grid">
        <div v-for="item in systems" :key="item.id" class="sys-card" @tap="openSystem(item)">
          <div class="sys-icon-wrap" :style="{ background: item.color }">
            <span class="sys-icon">{{ item.icon }}</span>
          </div>
          <span class="sys-name">{{ item.name }}</span>
          <span class="sys-desc">{{ item.desc }}</span>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


const systems = ref([
  { id: 1, name: '教务管理系统', icon: '📖', desc: '选课/成绩查询', url: 'https://jwxt.ppsuc.edu.cn/', color: 'linear-gradient(135deg, #001e40, #003366)' },
  { id: 2, name: '图书馆系统', icon: '📚', desc: '借阅/预约', url: 'https://lib.ppsuc.edu.cn/', color: 'linear-gradient(135deg, #466270, #5a7a8c)' },
  { id: 3, name: '一卡通中心', icon: '💳', desc: '充值/消费记录', url: 'https://ecard.ppsuc.edu.cn/', color: 'linear-gradient(135deg, #003366, #004d99)' },
  { id: 4, name: '校园网服务', icon: '🌐', desc: '网络认证/报修', url: 'http://10.1.1.1/', color: 'linear-gradient(135deg, #1a3a52, #2d5570)' },
  { id: 5, name: '后勤服务平台', icon: '🏠', desc: '宿舍报修/投诉', url: 'http://hq.ppsuc.edu.cn/', color: 'linear-gradient(135deg, #0d2137, #1a3854)' }
])

function openSystem(item) {
  uni.navigateTo({ url: `/pages/external/webview?name=${encodeURIComponent(item.name)}&url=${encodeURIComponent(item.url || '')}` })
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.external-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.sys-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; padding: 24rpx 32rpx;
}
.sys-card {
  background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx;
  &:active { opacity: 0.85; }
}
.sys-icon-wrap {
  width: 80rpx; height: 80rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 16rpx;
}
.sys-icon { font-size: 36rpx; }
.sys-name { font-family: 'PingFang SC'; font-size: 27rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 8rpx; }
.sys-desc { font-size: 22rpx; color: #c3c6d1; }
</style>
