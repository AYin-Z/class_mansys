<template>
  <div class="vote-page">
    <custom-nav-bar title="投票" />
    <div scroll-y class="main-scroll">
      <div class="vote-list">
        <div v-for="item in votes" :key="item.id" class="vote-card" @tap="goDetail(item)">
          <div class="card-accent" :class="item.status"></div>
          <div class="card-body">
            <div class="card-top">
              <span class="vote-title">{{ item.title }}</span>
              <div :class="['status-badge', item.status]">{{ statusText(item.status) }}</div>
            </div>
            <span class="vote-desc">{{ item.desc }}</span>
            <div class="vote-meta">
              <span class="meta-item">{{ item.type === 'single' ? '单选' : '多选' }}</span>
              <span class="meta-dot">·</span>
              <span class="meta-item">{{ item.total }}人已参与</span>
              <span class="meta-dot">·</span>
              <span class="meta-item">{{ item.deadline }}</span>
            </div>
            <div class="scope-row-sm" v-if="item.visible_scope === 'admin' || item.vote_scope === 'admin'">
              <span class="scope-tag-sm" v-if="item.visible_scope === 'admin'">👁️ 仅班干部</span>
              <span class="scope-tag-sm" v-if="item.vote_scope === 'admin'">🗳️ 仅班干部</span>
            </div>
          </div>
        </div>

        <div v-if="votes.length === 0" class="empty-state"><span class="empty-text">暂无投票</span></div>
      </div>

      <button v-if="canCreate" class="create-btn" @tap="goCreate"><span class="create-text">+ 创建投票</span></button>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getVotes, isVoteSingle, getVoteStatus } from '@/api/vote'
import { isAdmin } from '@/utils/auth'
const votes = ref([])
const canCreate = ref(false)

function statusText(s) {
  if (s === 'pending') return '未开始'
  if (s === 'active') return '进行中'
  return '已结束'
}

function formatDate(ts) {
  if (!ts) return ''
  return String(ts).substring(0, 10)
}

async function fetchData() {
  try {
    const res = await getVotes()
    if (res?.success) {
      votes.value = (res.votes || []).map(v => ({
        id: v.id,
        title: v.title,
        desc: v.description || '',
        type: isVoteSingle(v) ? 'single' : 'multiple',
        total: Number(v.participant_count || 0),
        deadline: formatDate(v.end_time),
        status: getVoteStatus(v)
      }))
    }
  } catch (e) {}
}

function statusText2(s) { return statusText(s) }
function goDetail(item) { uni.navigateTo({ url: `/pages/vote/detail?id=${item.id}` }) }
function goCreate() { router.push('/pages/vote/create') }

onShow(() => {
  canCreate.value = isAdmin()
  fetchData()
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.vote-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.vote-list { padding: 24rpx 32rpx; }

.vote-card { position: relative; display: flex; background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 16rpx; &:active { opacity: 0.85; } }
.card-accent {
  width: 10rpx; flex-shrink: 0;
  &.pending { background: #466270; }
  &.active { background: #001e40; }
  &.ended { background: #c3c6d1; }
}
.card-body { flex: 1; padding: 24rpx; }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.vote-title { font-family: 'PingFang SC'; font-size: 29rpx; font-weight: 600; color: #191c1e; flex: 1; }
.status-badge {
  padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.pending { background: rgba(70,98,112,0.08); color: #466270; }
  &.active { background: rgba(0,30,64,0.06); color: #001e40; }
  &.ended { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}
.vote-desc { font-size: 25rpx; color: #43474f; margin-bottom: 16rpx; display: block; line-height: 1.5; }
.vote-meta { display: flex; gap: 10rpx; align-items: center; flex-wrap: wrap; }
.meta-item { font-size: 22rpx; color: #c3c6d1; }
.meta-dot { font-size: 22rpx; color: #e0e3e6; }
.scope-row-sm { display: flex; gap: 8rpx; margin-top: 10rpx; }
.scope-tag-sm { font-size: 20rpx; color: #8c909a; background: rgba(140,144,154,0.08); padding: 2rpx 12rpx; border-radius: 999rpx; }

.create-btn { margin: 24rpx 32rpx; height: 88rpx; background: #f2f4f7; border-radius: 18rpx; border: none; display: flex; align-items: center; justify-content: center; &::after { display: none; } &:active { background: #eceef1; } }
.create-text { font-size: 28rpx; font-weight: 600; color: #001e40; }

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
