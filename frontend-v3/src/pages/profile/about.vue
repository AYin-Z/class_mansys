<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getLatestVersion } from '@/api/app'
import NavBar from '@/components/ui/NavBar.vue'

interface AppInfo {
  version: string
  versionCode: number
  releaseDate: string
}

const appInfo = ref<AppInfo | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await getLatestVersion()
    if (res.success && res.data) {
      appInfo.value = {
        version: res.data.versionName,
        versionCode: res.data.versionCode,
        releaseDate: res.data.releasedAt?.slice(0, 10) || '',
      }
    }
  } catch {
    // Fallback: use build-time version
    appInfo.value = {
      version: 'v0.3.0',
      versionCode: 3,
      releaseDate: '2025-05-01',
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="about-page">
    <NavBar title="关于我们" show-back />

    <div class="about-hero">
      <div class="logo-icon">🏫</div>
      <h1 class="app-name">区队管理系统</h1>
      <p v-if="appInfo" class="version">版本 {{ appInfo.version }}</p>
      <p v-else class="version">class-mansys</p>
    </div>

    <!-- 系统简介 -->
    <div class="section">
      <div class="section-title">系统简介</div>
      <div class="card">
        <p class="desc">
          区队管理系统是一个专为院校区队打造的数字化管理平台，
          覆盖通知发布、请假审批、班费管理、作业提交、活动投票、
          积分排行、心理关怀等日常管理场景，助力区队干部高效协作。
        </p>
      </div>
    </div>

    <!-- 开发团队 -->
    <div class="section">
      <div class="section-title">开发团队</div>
      <div class="card">
        <div class="info-row">
          <span class="info-label">开发单位</span>
          <span class="info-value">数据警务技术2025级六区队</span>
        </div>
        <div class="divider"></div>
        <div class="info-row">
          <span class="info-label">技术栈</span>
          <span class="info-value">Vue 3 + Vite + Node.js + SQLite</span>
        </div>
        <div class="divider"></div>
        <div class="info-row">
          <span class="info-label">部署平台</span>
          <span class="info-value">Google Cloud Run</span>
        </div>
      </div>
    </div>

    <!-- 版本信息 -->
    <div class="section" v-if="appInfo">
      <div class="section-title">版本信息</div>
      <div class="card">
        <div class="info-row">
          <span class="info-label">当前版本</span>
          <span class="info-value">{{ appInfo.version }}</span>
        </div>
        <div class="divider"></div>
        <div class="info-row">
          <span class="info-label">版本号</span>
          <span class="info-value">{{ appInfo.versionCode }}</span>
        </div>
        <div class="divider"></div>
        <div class="info-row">
          <span class="info-label">发布日期</span>
          <span class="info-value">{{ appInfo.releaseDate || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>数据警务技术2025级六区队 © {{ new Date().getFullYear() }}</p>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  padding-bottom: 80px;
  min-height: 100vh;
}

.about-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px 24px;
  background: var(--color-surface);
  margin-bottom: 16px;
}

.logo-icon {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--color-accent), #4f8cff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  margin-bottom: 16px;
}

.app-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 6px;
}

.version {
  font-size: 14px;
  color: var(--color-text-2);
  margin: 0;
}

.section {
  padding: 0 16px 16px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 10px;
  padding-left: 4px;
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 0 16px;
}

.desc {
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.7;
  padding: 16px 0;
  margin: 0;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
}

.info-label {
  font-size: 14px;
  color: var(--color-text);
}

.info-value {
  font-size: 14px;
  color: var(--color-text-2);
  text-align: right;
  max-width: 60%;
  word-break: break-all;
}

.divider {
  height: 1px;
  background: var(--color-border);
}

.footer {
  text-align: center;
  padding: 24px 16px 8px;
}

.footer p {
  font-size: 12px;
  color: var(--color-text-3);
  margin: 0;
}
</style>
