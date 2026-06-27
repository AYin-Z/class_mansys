<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getChallengeDetail, applyChallenge, judgeApplication,
  CHALLENGE_APP_STATUS_LABEL,
} from '@/api/challenge'
import { uploadFile } from '@/utils/request'
import { useUserStore } from '@/stores/user'
import type { ChallengeItem, ChallengeRecord, ChallengeApplication } from '@/api/challenge'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const challenge = ref<ChallengeItem | null>(null)
const records = ref<ChallengeRecord[]>([])
const applications = ref<ChallengeApplication[]>([])
const applying = ref(false)
const applyNotes = ref('')
const proofUrls = ref<string[]>([])
const uploadingProof = ref(false)

// 裁判
const judging = ref<number | null>(null)

function parseProofs(app: ChallengeApplication): string[] {
  try {
    const raw = (app as any).proof_urls
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') return JSON.parse(raw)
  } catch {}
  return []
}

onMounted(async () => {
  const id = Number(route.query.id)
  if (!id) { router.back(); return }
  try {
    const res = await getChallengeDetail(id)
    if (res.success) {
      challenge.value = res.challenge
      records.value = res.records || []
      applications.value = res.applications || []
    }
  } catch (_) {} finally { loading.value = false }
})

async function handleApply() {
  const id = Number(route.query.id)
  if (!id || applying.value) return
  applying.value = true
  try {
    const res = await applyChallenge(id, {
      notes: applyNotes.value.trim(),
      proof_urls: proofUrls.value.length > 0 ? proofUrls.value : undefined,
    } as any)
    if (res.success) {
      showToast('申请已提交，等待裁判')
      applyNotes.value = ''
      proofUrls.value = []
      const refreshed = await getChallengeDetail(id)
      if (refreshed.success) applications.value = refreshed.applications || []
    }
  } catch (e: any) { showToast(e.message || '申请失败', 'error') }
  finally { applying.value = false }
}

async function handleJudge(appId: number, result: 'challenger_win' | 'champion_win' | 'reject') {
  if (judging.value !== null) return
  judging.value = appId
  try {
    const res = await judgeApplication(appId, result)
    if (res.success) {
      showToast(res.message || '裁判完成')
      const id = Number(route.query.id)
      if (id) {
        const refreshed = await getChallengeDetail(id)
        if (refreshed.success) {
          challenge.value = refreshed.challenge
          records.value = refreshed.records || []
          applications.value = refreshed.applications || []
        }
      }
    }
  } catch (e: any) { showToast(e.message || '操作失败', 'error') }
  finally { judging.value = null }
}

// 证明上传
function triggerProof() {
  const inp = document.getElementById('challenge-proof-input') as HTMLInputElement
  inp?.click()
}
async function handleProofChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { showToast('仅支持图片', 'error'); target.value = ''; return }
  uploadingProof.value = true
  try {
    const res = await uploadFile('/api/challenge/upload-proof', file)
    if (res.success && res.url) proofUrls.value.push(res.url)
  } catch (e: any) { showToast(e.message || '上传失败', 'error') }
  finally { uploadingProof.value = false; target.value = '' }
}
function removeProof(i: number) { proofUrls.value.splice(i, 1) }

function formatDate(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="detail-page">
    <NavBar title="挑战详情" show-back />
    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="!challenge" class="state">擂台不存在</div>

    <template v-else>
      <!-- 擂台信息 -->
      <div class="hero">
        <div class="hero-icon">🏆</div>
        <div class="hero-info">
          <h2>{{ challenge.name }}</h2>
          <p>{{ challenge.description }}</p>
          <div class="hero-meta">
            <span class="tag">{{ challenge.type }}</span>
            <span>擂主：{{ challenge.champion_name || '无' }}</span>
            <span>{{ records.length }} 场记录</span>
          </div>
        </div>
      </div>

      <!-- 申请挑战 -->
      <div class="section">
        <h3>申请挑战</h3>
        <textarea v-model="applyNotes" class="field" rows="3" placeholder="描述你的挑战内容、希望见证人等" maxlength="300" />
        <div class="char-count">{{ applyNotes.length }}/300</div>

        <!-- 证明图片 -->
        <div class="proof-area">
          <div class="proof-list">
            <div v-for="(url, i) in proofUrls" :key="i" class="proof-item">
              <img :src="url" class="proof-thumb" />
              <button class="proof-del" @click="removeProof(i)">✕</button>
            </div>
            <!-- 上传中占位 -->
            <div v-if="uploadingProof" class="proof-item uploading">
              <span class="upload-spinner">⏳</span>
            </div>
          </div>
          <div v-if="uploadingProof" class="upload-status">正在上传...</div>
        </div>
        <div class="btn-row">
          <button class="btn-upload" :disabled="uploadingProof" @click="triggerProof">
            {{ uploadingProof ? '⏳ 上传中...' : '📎 上传证明' }}
          </button>
          <button class="btn-apply" :disabled="applying" @click="handleApply">
            {{ applying ? '提交中…' : '⚔️ 发起挑战' }}
          </button>
        </div>
        <input id="challenge-proof-input" type="file" accept="image/*" style="display:none" @change="handleProofChange" />
      </div>

      <!-- 待裁判申请（管理员） -->
      <div v-if="userStore.isAdmin && applications.length > 0" class="section">
        <h3>待裁判申请</h3>
        <div v-for="app in applications" :key="app.id" class="app-card">
          <div class="app-header">
            <span class="app-name">{{ app.user_name }}</span>
            <span class="app-sid">{{ app.student_id }}</span>
            <span v-if="app.status !== 0" class="app-status" :class="{ ok: app.status === 1, no: app.status === 2 }">
              {{ app.status === 1 ? '已通过' : '已驳回' }}
            </span>
          </div>
          <div v-if="app.notes" class="app-notes">📝 {{ app.notes }}</div>
          <!-- 证明图片 -->
          <div v-if="parseProofs(app).length > 0" class="app-proofs">
            <img v-for="(url, i) in parseProofs(app)" :key="i" :src="url" class="app-proof-img" @click="window.open(url)" />
          </div>
          <div v-if="app.status === 0" class="judge-row">
            <button class="btn-win" :disabled="judging !== null" @click="handleJudge(app.id, 'challenger_win')">挑战成功</button>
            <button class="btn-lose" :disabled="judging !== null" @click="handleJudge(app.id, 'champion_win')">守擂成功</button>
            <button class="btn-reject" :disabled="judging !== null" @click="handleJudge(app.id, 'reject')">驳回</button>
          </div>
        </div>
      </div>

      <!-- 战绩 -->
      <div class="section">
        <h3>战绩记录</h3>
        <div v-if="records.length === 0" class="empty">暂无记录</div>
        <div v-for="r in records" :key="r.id" class="record-item">
          <span class="rec-result" :class="{ win: r.result === '挑战成功' }">{{ r.result }}</span>
          <span>{{ r.challenger_name }} VS {{ r.champion_name }}</span>
          <span v-if="r.notes" class="rec-notes">{{ r.notes }}</span>
          <span class="rec-time">{{ formatDate(r.created_at) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page { padding-bottom: 80px; }
.state, .empty { text-align: center; padding: 36px 16px; font-size: 14px; color: var(--color-text-3); }

.hero {
  display: flex; gap: 14px; padding: 20px 16px; margin: 0 12px 16px;
  background: linear-gradient(135deg, #1a3a5c, #2d5a87); color: #fff;
  border-radius: var(--radius-md);
}
.hero-icon { font-size: 40px; flex-shrink: 0; }
.hero-info h2 { font-size: 20px; margin: 0 0 4px; }
.hero-info p { font-size: 13px; opacity: 0.8; margin: 0 0 8px; }
.hero-meta { font-size: 12px; display: flex; gap: 10px; opacity: 0.8; }
.tag { background: rgba(255,255,255,0.15); padding: 1px 8px; border-radius: 4px; }

.section { padding: 0 16px; margin-bottom: 20px; }
.section h3 { font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 10px; }

.field {
  width: 100%; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; background: var(--color-surface);
  color: var(--color-text); outline: none; resize: vertical; box-sizing: border-box;
}
.char-count { text-align: right; font-size: 11px; color: var(--color-text-3); margin-top: 2px; }

.proof-area { margin: 8px 0; }
.proof-list { display: flex; flex-wrap: wrap; gap: 6px; }
.proof-item { position: relative; width: 56px; height: 56px; border-radius: 6px; overflow: hidden; }
.proof-item.uploading {
  background: var(--color-surface-hover); border: 2px dashed var(--color-accent);
  display: flex; align-items: center; justify-content: center;
}
.upload-spinner { font-size: 24px; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.upload-status { font-size: 12px; color: var(--color-accent); margin-top: 4px; font-weight: 500; }
.proof-thumb { width: 100%; height: 100%; object-fit: cover; }
.proof-del {
  position: absolute; top: 0; right: 0; width: 18px; height: 18px; border: none;
  border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; cursor: pointer;
}

.btn-row { display: flex; gap: 8px; margin-top: 10px; }
.btn-upload, .btn-apply {
  flex: 1; height: 40px; border: none; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-upload { background: var(--color-surface-hover); color: var(--color-text-2); }
.btn-apply { background: var(--color-accent); color: #fff; }
.btn-apply:disabled, .btn-upload:disabled { opacity: 0.5; }

/* 申请卡片 + 裁判 */
.app-card {
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); padding: 12px 14px; margin-bottom: 8px;
}
.app-header { display: flex; gap: 8px; align-items: center; }
.app-name { font-weight: 600; color: var(--color-text); font-size: 14px; }
.app-sid { font-size: 12px; color: var(--color-text-3); }
.app-status { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.app-status.ok { background: #dcfce7; color: #16a34a; }
.app-status.no { background: var(--color-error-bg); color: var(--color-error); }
.app-notes { font-size: 13px; color: var(--color-text-2); margin-top: 6px; }
.app-proofs { display: flex; gap: 6px; margin-top: 6px; }
.app-proof-img { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer; }

.judge-row { display: flex; gap: 6px; margin-top: 10px; }
.judge-row button {
  flex: 1; height: 34px; border: none; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600; cursor: pointer;
}
.btn-win { background: #dcfce7; color: #16a34a; }
.btn-lose { background: var(--color-accent-bg); color: var(--color-accent); }
.btn-reject { background: var(--color-error-bg); color: var(--color-error); }
.judge-row button:disabled { opacity: 0.5; }

/* 战绩 */
.record-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 0;
  font-size: 13px; color: var(--color-text-2);
  border-bottom: 1px solid var(--color-border);
}
.record-item:last-child { border-bottom: none; }
.rec-result { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--color-surface-hover); }
.rec-result.win { background: #dcfce7; color: #16a34a; }
.rec-notes { font-size: 11px; color: var(--color-text-3); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-time { font-size: 11px; color: var(--color-text-3); margin-left: auto; }
</style>
