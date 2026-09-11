<script setup lang="ts">
/**
 * 挑战擂台详情
 *
 * 2026-09（体验修复）：
 *  - 缺 id 时原实现直接在 try 之前 return，loading 永远为 true（白屏骨架）
 *    → 先置 loading=false 再返回；
 *  - 申请成功后原实现不刷新「我的申请」，学员看不到自己的申请进度、容易重复提交
 *    → await loadMyApplications() + 成功提示，失败走 else 分支提示；
 *  - catch (_) {} 吞失败 → error + 重试；「我的申请」失败不再伪装成「没有申请」；
 *  - 裁判结果不可更改，三个动作加确认；写操作按钮加在途锁；
 *  - emoji（🏆⏳📎⚔️📝✕）→ AppIcon；硬编码色值 → 令牌。
 */
import { mediaUrl, openMedia } from '@/utils/media'
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getChallengeDetail, applyChallenge, judgeApplication, getMyChallengeApplications,
  CHALLENGE_APP_STATUS_LABEL,
} from '@/api/challenge'
import {toastIfNotNotified} from '@/utils/request'
import { useUserStore } from '@/stores/user'
import type { ChallengeItem, ChallengeRecord, ChallengeApplication } from '@/api/challenge'
import { uploadMedia } from '@/utils/upload'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const error = ref<unknown>(null)
const challenge = ref<ChallengeItem | null>(null)
const records = ref<ChallengeRecord[]>([])
const applications = ref<ChallengeApplication[]>([])
const applying = ref(false)
const applyNotes = ref('')
const proofUrls = ref<string[]>([])
const uploadingProof = ref(false)
const proofInput = ref<HTMLInputElement | null>(null)

// 裁判
const judging = ref<number | null>(null)
// 我的申请（学员视角）：审计修复——提交后没有任何地方能看到审批进度
const myApplications = ref<ChallengeApplication[]>([])
const myAppsLoading = ref(false)
const myAppsError = ref<unknown>(null)
async function loadMyApplications() {
  myAppsLoading.value = true
  myAppsError.value = null
  try {
    const res = await getMyChallengeApplications()
    if (res?.success) myApplications.value = res.applications || []
    else myAppsError.value = new Error('加载我的申请失败')
  } catch (e) {
    myAppsError.value = e
  } finally {
    myAppsLoading.value = false
  }
}
// 裁判申请需要 JUDGE_CHALLENGE 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canJudgeChallenge = computed(() => userStore.hasPermission('JUDGE_CHALLENGE'))
/** 本擂台下我自己的申请 */
const myAppList = computed(() => myApplications.value.filter((a) => Number(a.challenge_id) === Number(challenge.value?.id)))

function parseProofs(app: ChallengeApplication): string[] {
  const raw = (app as any).proof_urls
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      // 历史数据里 proof_urls 可能是非 JSON 文本：按「无证明」处理
      return []
    }
  }
  return []
}

async function load() {
  loading.value = true
  error.value = null
  const id = Number(route.query.id)
  if (!id) {
    // 无 id：必须先把 loading 关掉，否则页面永远停在骨架屏
    loading.value = false
    router.back()
    return
  }
  try {
    const res = await getChallengeDetail(id)
    if (res.success) {
      challenge.value = res.challenge
      records.value = res.records || []
      applications.value = res.applications || []
    } else {
      error.value = new Error('加载擂台详情失败，请稍后重试')
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
  await loadMyApplications()
}

onMounted(load)

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
      showToast('申请已提交，等待裁判', 'success')
      applyNotes.value = ''
      proofUrls.value = []
      const refreshed = await getChallengeDetail(id)
      if (refreshed.success) applications.value = refreshed.applications || []
      // 关键：刷新「我的申请」，否则学员看不到自己的申请进度
      await loadMyApplications()
    } else {
      showToast(res.message || '申请提交失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '申请提交失败，请稍后重试')
  }
  finally { applying.value = false }
}

async function handleJudge(appId: number, result: 'challenger_win' | 'champion_win' | 'reject') {
  if (judging.value !== null) return
  const target = applications.value.find(a => a.id === appId)
  const who = target?.user_name || '该申请'
  const confirmMap = {
    challenger_win: {
      title: '判定挑战成功',
      content: `${who} 将成为新擂主`,
      hint: '裁判结果提交后不可更改，战绩记录会同步生成',
      confirmText: '判定成功',
    },
    champion_win: {
      title: '判定守擂成功',
      content: `${who} 的挑战将被判定为失败，原擂主继续守擂`,
      hint: '裁判结果提交后不可更改，战绩记录会同步生成',
      confirmText: '判定守擂',
    },
    reject: {
      title: '驳回挑战申请',
      content: `驳回 ${who} 的挑战申请`,
      hint: '驳回后申请人需要重新提交申请',
      confirmText: '驳回',
    },
  }[result]
  const ok = await showConfirm(confirmMap.title, confirmMap.content, {
    danger: result === 'reject',
    confirmText: confirmMap.confirmText,
    hint: confirmMap.hint,
  })
  if (!ok) return

  judging.value = appId
  try {
    const res = await judgeApplication(appId, result)
    if (res.success) {
      showToast(res.message || '裁判完成', 'success')
      const id = Number(route.query.id)
      if (id) {
        const refreshed = await getChallengeDetail(id)
        if (refreshed.success) {
          challenge.value = refreshed.challenge
          records.value = refreshed.records || []
          applications.value = refreshed.applications || []
        }
      }
      await loadMyApplications()
    } else {
      showToast(res.message || '裁判失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '裁判失败，请稍后重试')
  }
  finally { judging.value = null }
}

// 证明上传
function triggerProof() {
  proofInput.value?.click()
}
async function handleProofChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { showToast('仅支持图片', 'error'); target.value = ''; return }
  uploadingProof.value = true
  try {
    // 统一媒体端点（图片会先压缩）
    const res = await uploadMedia(file, 'proof')
    if (res.url) proofUrls.value.push(res.url)
  } catch (e) {
    toastIfNotNotified(e, '证明上传失败，请稍后重试')
  }
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

    <StateView
      :loading="loading"
      :error="error"
      :empty="!challenge"
      loading-text="正在加载擂台详情…"
      empty-icon="trophy"
      empty-title="擂台不存在"
      empty-description="擂台可能已被删除，请返回列表重新进入"
      @retry="load"
    >
      <template v-if="challenge">
        <!-- 擂台信息 -->
        <div class="hero">
          <div class="hero-icon"><AppIcon name="trophy" :size="36" :stroke="1.6" /></div>
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
                <img :src="mediaUrl(url)" class="proof-thumb" alt="挑战证明" />
                <button class="proof-del" type="button" aria-label="移除证明" @click="removeProof(i)">
                  <AppIcon name="close" :size="13" />
                </button>
              </div>
            </div>
            <div v-if="uploadingProof" class="upload-status">正在上传…</div>
          </div>
          <div class="btn-row">
            <BaseButton
              variant="secondary"
              :loading="uploadingProof"
              :disabled="uploadingProof"
              @click="triggerProof"
            >
              <AppIcon name="upload" :size="16" />
              <span>{{ uploadingProof ? '上传中…' : '上传证明' }}</span>
            </BaseButton>
            <BaseButton :loading="applying" :disabled="applying" @click="handleApply">
              <AppIcon name="send" :size="16" />
              <span>{{ applying ? '提交中…' : '发起挑战' }}</span>
            </BaseButton>
          </div>
          <input ref="proofInput" type="file" accept="image/*" class="file-hidden" @change="handleProofChange" />
        </div>

        <!-- 我的申请（学员侧进度）：
             加载中/加载失败都要显示出来——失败被伪装成「没有申请」会让学员重复提交 -->
        <div v-if="myAppsLoading || myAppsError || myAppList.length" class="section">
          <h3>我的申请</h3>
          <StateView
            slim
            :loading="myAppsLoading"
            :error="myAppsError"
            @retry="loadMyApplications"
          >
            <div v-for="app in myAppList" :key="app.id" class="app-card">
              <div class="app-head">
                <span>{{ String(app.created_at || '').slice(0, 16).replace('T', ' ') }}</span>
                <BaseBadge :variant="app.status === 1 ? 'success' : app.status === 2 ? 'danger' : 'warning'">
                  {{ CHALLENGE_APP_STATUS_LABEL[app.status] || app.status }}
                </BaseBadge>
              </div>
              <p v-if="app.notes" class="app-notes">{{ app.notes }}</p>
            </div>
          </StateView>
        </div>

        <!-- 待裁判申请（需 JUDGE_CHALLENGE 权限） -->
        <div v-if="canJudgeChallenge && applications.length > 0" class="section">
          <h3>待裁判申请</h3>
          <div v-for="app in applications" :key="app.id" class="app-card">
            <div class="app-header">
              <span class="app-name">{{ app.user_name }}</span>
              <span class="app-sid">{{ app.student_id }}</span>
              <BaseBadge v-if="app.status !== 0" :variant="app.status === 1 ? 'success' : 'danger'">
                {{ app.status === 1 ? '已通过' : '已驳回' }}
              </BaseBadge>
            </div>
            <div v-if="app.notes" class="app-notes">
              <AppIcon name="edit" :size="13" />
              <span>{{ app.notes }}</span>
            </div>
            <!-- 证明图片 -->
            <div v-if="parseProofs(app).length > 0" class="app-proofs">
              <img
                v-for="(url, i) in parseProofs(app)"
                :key="i"
                :src="mediaUrl(url)"
                class="app-proof-img"
                alt="挑战证明"
                @click="openMedia(url)"
              />
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
    </StateView>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; }
.empty { text-align: center; padding: 36px 16px; font-size: var(--font-size-body); color: var(--color-text-3); }

.hero {
  display: flex; gap: 14px; padding: 20px 16px; margin: 0 12px 16px;
  background: linear-gradient(135deg, var(--color-hero-from), var(--color-hero-to)); color: #fff;
  border-radius: var(--radius-md);
}
.hero-icon { flex-shrink: 0; }
.hero-info h2 { font-size: var(--font-size-title); margin: 0 0 4px; }
.hero-info p { font-size: var(--font-size-sm); opacity: 0.85; margin: 0 0 8px; }
.hero-meta { font-size: var(--font-size-xs); display: flex; gap: 10px; opacity: 0.85; flex-wrap: wrap; }
.tag { background: rgba(255,255,255,0.15); padding: 1px 8px; border-radius: var(--radius-sm); }

.section { padding: 0 16px; margin-bottom: 20px; }
.section h3 { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); margin-bottom: 10px; }

.field {
  width: 100%; padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--font-size-body); background: var(--color-surface);
  color: var(--color-text); outline: none; resize: vertical; box-sizing: border-box;
  font-family: inherit;
}
.field:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
.char-count { text-align: right; font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 2px; }

.proof-area { margin: 8px 0; }
.proof-list { display: flex; flex-wrap: wrap; gap: 6px; }
.proof-item { position: relative; width: 56px; height: 56px; border-radius: var(--radius-sm); overflow: hidden; }
.upload-status { font-size: var(--font-size-sm); color: var(--color-accent); margin-top: 4px; font-weight: 500; }
.proof-thumb { width: 100%; height: 100%; object-fit: cover; }
.proof-del {
  position: absolute; top: 0; right: 0; width: 32px; height: 32px; border: none;
  border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.btn-row { display: flex; gap: 8px; margin-top: 10px; }
.btn-row > :deep(*) { flex: 1; }
.file-hidden { display: none; }

/* 申请卡片 + 裁判 */
.app-card {
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); padding: 12px 14px; margin-bottom: 8px;
}
.app-header { display: flex; gap: 8px; align-items: center; }
.app-head { display: flex; gap: 8px; align-items: center; justify-content: space-between; font-size: var(--font-size-sm); color: var(--color-text-2); }
.app-name { font-weight: 600; color: var(--color-text); font-size: var(--font-size-body); }
.app-sid { font-size: var(--font-size-xs); color: var(--color-text-3); }
.app-notes { display: flex; align-items: center; gap: 4px; font-size: var(--font-size-sm); color: var(--color-text-2); margin-top: 6px; }
.app-proofs { display: flex; gap: 6px; margin-top: 6px; }
.app-proof-img { width: 60px; height: 60px; object-fit: cover; border-radius: var(--radius-sm); cursor: pointer; }

.judge-row { display: flex; gap: 6px; margin-top: 10px; }
.judge-row button {
  flex: 1; min-height: 44px; border: none; border-radius: var(--radius-sm);
  font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; font-family: inherit;
}
.btn-win { background: var(--color-success-bg); color: var(--color-success); }
.btn-lose { background: var(--color-accent-bg); color: var(--color-accent); }
.btn-reject { background: var(--color-error-bg); color: var(--color-error); }
.judge-row button:disabled { opacity: 0.5; }

/* 战绩 */
.record-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 0;
  font-size: var(--font-size-sm); color: var(--color-text-2);
  border-bottom: 1px solid var(--color-border);
}
.record-item:last-child { border-bottom: none; }
.rec-result { font-size: var(--font-size-xs); font-weight: 600; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--color-surface-hover); }
.rec-result.win { background: var(--color-success-bg); color: var(--color-success); }
.rec-notes { font-size: var(--font-size-xs); color: var(--color-text-3); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-time { font-size: var(--font-size-xs); color: var(--color-text-3); margin-left: auto; }
</style>
