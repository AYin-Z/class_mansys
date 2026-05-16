<template>
  <div class="lottery-page">
    <custom-nav-bar title="抽奖活动" />
    <div scroll-y class="main-scroll">
      <div class="active-lottery" v-if="activeList.length">
        <span class="section-label">进行中</span>
        <div v-for="lot in activeList" :key="lot.id" class="lottery-card" @tap="goDetail(lot)">
          <div class="prize-area">
            <span class="prize-icon">🎁</span>
            <div class="prize-info">
              <span class="prize-name">{{ lot.name }}</span>
              <span class="prize-desc">{{ lot.description || lot.rules }}</span>
            </div>
          </div>
          <div class="lottery-meta">
            <span class="meta-item">已参与 {{ lot.participant_count || 0 }} 人</span>
            <span class="meta-dot">·</span>
            <span class="meta-item">截止 {{ formatDate(lot.end_time) }}</span>
          </div>
        </div>
      </div>

      <div class="history-section">
        <span class="section-label">历史记录</span>
        <div v-for="item in endedList" :key="item.id" class="hist-card" @tap="goDetail(item)">
          <div class="hist-body">
            <span class="hist-name">{{ item.name }}</span>
            <span class="hist-time">{{ formatDate(item.end_time) }}</span>
            <div class="hist-status won" v-if="item.winner_count">🏆 已开奖</div>
            <div class="hist-status lost" v-else>未开奖</div>
          </div>
        </div>

        <div v-if="!loading && lotteries.length === 0" class="empty-state"><span class="empty-text">暂无抽奖活动</span></div>
      </div>

      <button class="create-btn" v-if="isAdminUser" @tap="goCreate"><span class="create-text">+ 创建抽奖</span></button>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getLotteries } from '@/api/lottery'
const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const lotteries = ref([])
const loading = ref(false)

const activeList = computed(() => lotteries.value.filter(l => !!l.is_active))
const endedList = computed(() => lotteries.value.filter(l => !l.is_active))

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getLotteries()
    lotteries.value = res?.lotteries || []
  } catch (_) { lotteries.value = [] }
  finally { loading.value = false }
}

function goDetail(item) { router.push(`/pages/lottery/detail?id=${item.id}`) }
function goCreate() { router.push('/pages/lottery/create') }

onShow(() => fetchList())

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.lottery-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 4rpx; display: block; margin-bottom: 16rpx; }

.active-lottery { padding: 24rpx 32rpx; }
.lottery-card {
  background: linear-gradient(135deg, #001e40, #003366); border-radius: 22rpx;
  padding: 32rpx 28rpx; &:active { opacity: 0.9; }
}
.prize-area { display: flex; align-items: center; gap: 20rpx; margin-bottom: 20rpx; }
.prize-icon { font-size: 56rpx; }
.prize-info { flex: 1; }
.prize-name { font-family: 'PingFang SC'; font-size: 33rpx; font-weight: 700; color: #fff; display: block; }
.prize-desc { font-size: 25rpx; color: rgba(255,255,255,0.7); display: block; margin-top: 4rpx; }

.lottery-meta { display: flex; gap: 10rpx; align-items: center; flex-wrap: wrap; margin-bottom: 14rpx; }
.meta-item { font-size: 23rpx; color: rgba(255,255,255,0.75); }
.meta-dot { font-size: 23rpx; color: rgba(255,255,255,0.4); }

.progress-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 22rpx; }
.progress-bar { flex: 1; height: 10rpx; background: rgba(255,255,255,0.15); border-radius: 5rpx; overflow: hidden; }
.progress-fill { height: 100%; background: #fff; border-radius: 5rpx; transition: width 0.3s; }
.progress-pct { font-size: 23rpx; color: #fff; font-weight: 600; white-space: nowrap; }

.join-btn {
  width: 100%; height: 84rpx; background: #fff; border-radius: 42rpx; border: none;
  font-size: 29rpx; font-weight: 700; color: #001e40; &::after { display: none; } &:active { transform: scale(0.97); }
}

.history-section { padding: 0 32rpx; margin-top: 28rpx; }
.hist-card { background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; &:active { opacity: 0.85; } }
.hist-body { padding: 22rpx 24rpx; display: flex; align-items: center; gap: 12rpx; }
.hist-name { flex: 1; font-size: 27rpx; font-weight: 500; color: #191c1e; }
.hist-time { font-size: 22rpx; color: #c3c6d1; white-space: nowrap; }
.hist-status {
  padding: 5rpx 14rpx; border-radius: 999rpx; font-size: 21rpx; font-weight: 600;
  &.won { background: rgba(70,98,112,0.08); color: #466270; }
  &.lost { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}

.create-btn { margin: 24rpx 32rpx; height: 88rpx; background: #f2f4f7; border-radius: 18rpx; border: none; display: flex; align-items: center; justify-content: center; &::after { display: none; } &:active { background: #eceef1; } }
.create-text { font-size: 28rpx; font-weight: 600; color: #001e40; }

.empty-state { padding: 60rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
