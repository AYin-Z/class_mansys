<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import NavBar from '@/components/ui/NavBar.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import ImageViewer from '@/components/ui/ImageViewer.vue'
import type { ViewerImage } from '@/components/ui/ImageViewer.vue'
import { showToast } from '@/utils/ui'
import { apiUrl, getToken } from '@/utils/request'
import { renderMarkdown } from '@/utils/markdown'
import { buildMcpAgentPrompt, buildMcpConfigJson, buildMcpStdioConfig } from '@/utils/mcpPrompt'
import { mediaUrl, thumbUrl, onThumbError } from '@/utils/media'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import {
  agentChat,
  agentConfirm,
  getAgentTools,
  uploadAgentAttachment,
  issueBindCode,
  listBindings,
  unbindWechat,
  listApiTokens,
  createApiToken,
  revokeApiToken,
  getBotLogin,
  startBotLogin,
  pollBotLogin,
  mcpSelfCheck,
  type AgentMessage,
  type AgentPendingAction,
  type AgentAttachment,
  type AgentToolModule,
  type AgentApiToken,
  type WechatBinding,
  type WechatBotStatus,
} from '@/api/agent'

const MAX_ATTACHMENTS = 6
/** 确认卡片有效期（与手册承诺的 5 分钟一致） */
const PENDING_TTL_MS = 5 * 60 * 1000
/**
 * 示例问题（2026-09 B5）：
 *  - 原来固定 5 条且含残句「给个建议：」，点了等于空发；
 *  - 「今天中队出勤怎么样」只有干部有 VIEW_COMPANY 权限，学员点了会被拒，
 *    会让人以为助手坏了 → 现在按权限过滤，并且首条消息后自动收起。
 */
const ALL_SUGGESTIONS: { text: string; perm?: string }[] = [
  { text: '我的请假记录' },
  { text: '我要请明天的早操假' },
  { text: '怎么请假？' },
  { text: '我想提个建议' },
  { text: '今天中队出勤怎么样', perm: 'VIEW_COMPANY' },
  { text: '这个月班费还剩多少' },
]

type UiMessage = AgentMessage & { attachments?: AgentAttachment[] }

const messages = ref<UiMessage[]>([])
const input = ref('')
const sending = ref(false)
const uploading = ref(false)
const conversationId = ref<number | undefined>(undefined)
const pending = ref<AgentPendingAction | null>(null)
/** 确认卡片下发时间：用于显示剩余有效期（此前卡片没有过期信息，过期点确认只报错） */
const pendingAt = ref(0)
const nowTick = ref(Date.now())
setInterval(() => { nowTick.value = Date.now() }, 1000)
const pendingExpired = computed(() => !!pending.value && nowTick.value - pendingAt.value > PENDING_TTL_MS)
const pendingLeftText = computed(() => {
  const left = Math.max(0, PENDING_TTL_MS - (nowTick.value - pendingAt.value))
  const s = Math.ceil(left / 1000)
  return s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`
})
/** 首条消息后收起示例问题，避免一直挂着占屏 */
const suggestedUsed = ref(false)
const suggestions = computed(() =>
  ALL_SUGGESTIONS.filter((x) => !x.perm || userStore.hasPermission(x.perm as any)).map((x) => x.text),
)
const showSuggestions = computed(() => !suggestedUsed.value && messages.value.length <= 1)
const modules = ref<AgentToolModule[]>([])
const sheet = ref<'tools' | 'access' | null>(null)
const scroller = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const listening = ref(false)
const attachments = ref<AgentAttachment[]>([])

/**
 * 图片查看器（统一走公共组件 ImageViewer）
 *
 * 之前点图片是 window.open 看原图：手机上会离开应用，装成 APK 后可能没反应，
 * 而且拉的是几 MB 的原图。现在改成组件内的中图查看器，同一批图片可左右滑动。
 */
const viewerOpen = ref(false)
const viewerStart = ref(0)
const viewerImages = ref<ViewerImage[]>([])

function openViewer(images: ViewerImage[], index: number) {
  if (images.length === 0) return
  viewerImages.value = images
  viewerStart.value = index
  viewerOpen.value = true
}

/** 一条消息里的全部图片：这样才能左右滑动看同一批图（下标与缩略图一致） */
function openMessageImage(m: UiMessage, index: number) {
  const list = (m.attachments || []).map((a) => ({ url: a.url, title: a.name || '图片' }))
  openViewer(list, index)
}

/** 待发送的附件行同一条消息：整行一起滑 */
function openPendingImage(index: number) {
  const list = attachments.value.map((a) => ({ url: a.url, title: a.name || '图片' }))
  openViewer(list, index)
}

const userStore = useUserStore()
const router = useRouter()
const canManageChannel = computed(() => userStore.hasPermission('MANAGE_CHANNEL'))

// —— 微信机器人（超管） ——
const bot = ref<WechatBotStatus | null>(null)
const botBusy = ref(false)
const botPolling = ref(false)
let botTimer: any = null

// —— 账号绑定 / MCP 令牌 ——
const bindCode = ref('')
const bindCodeLeft = ref(0)
const bindings = ref<WechatBinding[]>([])
const tokens = ref<AgentApiToken[]>([])
const newTokenName = ref('')
const newTokenWrite = ref(false)
const freshToken = ref('')
const mcpCheck = ref<{ ok: boolean; text: string; toolCount?: number; allowWrite?: boolean } | null>(null)
const bindCodeRef = ref<HTMLElement | null>(null)
const tokenBoxRef = ref<HTMLElement | null>(null)
const mcpEndpoint = computed(() => (typeof window !== 'undefined' ? window.location.origin : '') + '/api/mcp')
const mcpConfig = computed(() => buildMcpConfigJson(mcpEndpoint.value, freshToken.value))
const mcpStdioConfig = computed(() => buildMcpStdioConfig(freshToken.value))
const mcpPrompt = computed(() =>
  buildMcpAgentPrompt({
    endpoint: mcpEndpoint.value,
    token: freshToken.value,
    allowWrite: mcpCheck.value?.allowWrite ?? newTokenWrite.value,
    toolCount: mcpCheck.value?.toolCount,
  }),
)
let bindTimer: any = null

const toolsError = ref<unknown>(null)

async function loadTools() {
  toolsError.value = null
  try {
    const res = await getAgentTools()
    if (res?.success) modules.value = res.data?.modules || []
    else toolsError.value = new Error('能力清单加载失败')
  } catch (e) {
    // 之前是静默 catch，抽屉里显示「我能办哪些事（0 个模块）」，用户以为助手什么都不能办
    toolsError.value = e
  }
}

onMounted(async () => {
  await loadTools()
  messages.value.push({
    role: 'assistant',
    content:
      '你好，我是**办事助手**。\n\n' +
      '- 直接说要办的事（例如「我要请明天的早操假」「报销班费」「提个建议」）\n' +
      '- 也可以问某个功能怎么用（例如「怎么请假？」）\n' +
      '- 还能发**图片/附件**给我，用来补请假证明、传相册照片\n\n' +
      '写操作我会先给你一张确认卡片，点「确认执行」才会真正提交。',
  })
  await Promise.all([loadBot(), loadAccess()])
})

onUnmounted(() => {
  stopBotPolling()
  if (bindTimer) clearInterval(bindTimer)
})

/** 用户消息按纯文本渲染（保留换行），避免用户输入被当成 HTML/Markdown 执行 */
function escapeText(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

/* ---------------- 对话 ---------------- */

/** SSE 流式对话；失败自动回退到普通接口 */
async function chatStreaming(content: string, atts: AgentAttachment[] = []): Promise<{ reply: string; pendingAction?: AgentPendingAction | null; conversationId?: number } | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(apiUrl('/api/agent/chat/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ message: content, conversationId: conversationId.value, attachments: atts }),
    })
    if (!res.ok || !res.body) return null

    const assistantIndex = messages.value.push({ role: 'assistant', content: '' }) - 1
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let pendingAction: AgentPendingAction | null = null
    let convId: number | undefined
    let reply = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        let event: any
        try { event = JSON.parse(line.slice(5).trim()) } catch { continue }
        if (event.type === 'delta') {
          messages.value[assistantIndex].content += event.content
          await scrollToBottom()
        } else if (event.type === 'pending') {
          pendingAction = event.action
        } else if (event.type === 'done') {
          reply = event.reply || messages.value[assistantIndex].content
          convId = event.conversationId
          if (event.pendingAction) pendingAction = event.pendingAction
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
    }
    if (!reply) reply = messages.value[assistantIndex].content
    messages.value[assistantIndex].content = reply
    return { reply, pendingAction, conversationId: convId }
  } catch (e) {
    return null
  }
}

async function send(text?: string) {
  suggestedUsed.value = true
  const content = (text ?? input.value).trim()
  const atts = attachments.value.slice()
  if ((!content && !atts.length) || sending.value) return
  messages.value.push({ role: 'user', content, attachments: atts })
  input.value = ''
  attachments.value = []
  sending.value = true
  await scrollToBottom()
  try {
    // 注意：必须把附件快照传进去（attachments.value 在本函数前面已被清空）
    const streamed = await chatStreaming(content, atts)
    if (streamed) {
      if (streamed.conversationId) conversationId.value = streamed.conversationId
      pending.value = streamed.pendingAction || null
      if (pending.value) pendingAt.value = Date.now()
    } else {
      const res = await agentChat(content, conversationId.value, atts)
      if (res?.conversationId) conversationId.value = res.conversationId
      if (res?.reply) messages.value.push({ role: 'assistant', content: res.reply })
      pending.value = res?.pendingAction || null
      if (pending.value) pendingAt.value = Date.now()
    }
  } catch (e: any) {
    showToast(e?.message || '助手暂时不可用', 'error')
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

async function confirmAction() {
  if (!pending.value) return
  const action = pending.value
  sending.value = true
  try {
    const res = await agentConfirm(action.id)
    messages.value.push({ role: 'assistant', content: res?.reply || '已处理' })
    pending.value = null
  } catch (e: any) {
    showToast(e?.message || '执行失败', 'error')
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function cancelAction() {
  pending.value = null
  messages.value.push({ role: 'assistant', content: '好的，已取消这次操作。' })
}

/* ---------------- 附件 ---------------- */
function pickFile() {
  fileInput.value?.click()
}

async function onFiles(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''
  if (!files.length) return
  if (attachments.value.length + files.length > MAX_ATTACHMENTS) {
    showToast('一次最多发 ' + MAX_ATTACHMENTS + ' 张图片', 'error')
    return
  }
  uploading.value = true
  try {
    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        showToast('目前只支持图片', 'error')
        continue
      }
      const res = await uploadAgentAttachment(f)
      if (res?.success) {
        attachments.value.push({ url: res.url, name: res.name, mime: res.mime, size: res.size, isImage: true })
      }
    }
  } catch (err: any) {
    showToast(err?.message || '上传失败', 'error')
  } finally {
    uploading.value = false
  }
}

function removeAttachment(i: number) {
  attachments.value.splice(i, 1)
}

/* ---------------- 语音 ---------------- */
function startVoice() {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) {
    showToast('当前环境不支持语音输入', 'error')
    return
  }
  const rec = new SR()
  rec.lang = 'zh-CN'
  rec.interimResults = false
  rec.onresult = (e: any) => {
    const text = e.results?.[0]?.[0]?.transcript || ''
    if (text) input.value = (input.value ? input.value + ' ' : '') + text
  }
  rec.onend = () => { listening.value = false }
  rec.onerror = () => { listening.value = false; showToast('语音识别失败', 'error') }
  listening.value = true
  rec.start()
}

/* ---------------- 接入设置：微信 / MCP ---------------- */
async function loadAccess() {
  try {
    const [b, t] = await Promise.all([listBindings(), listApiTokens()])
    bindings.value = b || []
    tokens.value = (t || []).filter((x) => !x.revoked_at)
  } catch (_) { /* 侧栏信息失败不阻塞对话 */ }
}

async function genBindCode() {
  try {
    const res = await issueBindCode()
    if (!res?.code) throw new Error('服务端未返回绑定码，请重试')
    bindCode.value = res.code
    bindCodeLeft.value = res.expiresInSec || 900
    if (bindTimer) clearInterval(bindTimer)
    bindTimer = setInterval(() => {
      bindCodeLeft.value -= 1
      if (bindCodeLeft.value <= 0) { clearInterval(bindTimer); bindCode.value = '' }
    }, 1000)
    showToast('绑定码已生成，请在微信里发送 /绑定 ' + res.code)
    await nextTick()
    bindCodeRef.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch (e: any) { showToast(e?.message || '生成失败，请重试', 'error') }
}

async function doUnbind(id: number) {
  try {
    await unbindWechat(id)
    showToast('已解绑')
    await loadAccess()
  } catch (e: any) { showToast(e?.message || '解绑失败', 'error') }
}

async function genToken() {
  try {
    const res = await createApiToken(newTokenName.value.trim() || '我的智能体', newTokenWrite.value)
    if (!res?.token) throw new Error('服务端未返回令牌，请重试')
    freshToken.value = res.token
    mcpCheck.value = null
    newTokenName.value = ''
    showToast('令牌已生成，请立即复制保存（只显示这一次）')
    await loadAccess()
    await nextTick()
    tokenBoxRef.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch (e: any) { showToast(e?.message || '创建失败', 'error') }
}

/** 一键：新建令牌 + 复制给 AI 的提示词（老令牌看不到明文，这是最顺的路径） */
async function genTokenAndCopyPrompt() {
  try {
    const res = await createApiToken(newTokenName.value.trim() || '我的智能体', newTokenWrite.value)
    if (!res?.token) throw new Error('服务端未返回令牌，请重试')
    freshToken.value = res.token
    mcpCheck.value = null
    newTokenName.value = ''
    await loadAccess()
    await copyText(buildMcpAgentPrompt({
      endpoint: mcpEndpoint.value,
      token: res.token,
      allowWrite: res.allowWrite
    }))
    showToast('令牌已生成，提示词已复制——直接粘给你的 AI 即可')
    await nextTick()
    tokenBoxRef.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch (e: any) {
    showToast(e?.message || '生成失败', 'error')
  }
}

/** 用户确认已保存后收起明文 */
function dismissFreshToken() {
  freshToken.value = ''
  mcpCheck.value = null
}

/** 不用 AI 客户端也能验证：拿令牌调 /api/mcp/info */
async function checkMcp() {
  if (!freshToken.value) return
  mcpCheck.value = { ok: false, text: '检测中…' }
  try {
    const data = await mcpSelfCheck(freshToken.value)
    mcpCheck.value = {
      ok: true,
      toolCount: data.toolCount,
      allowWrite: data.allowWrite,
      text: '连接正常：' + data.toolCount + ' 个工具 · ' + (data.allowWrite ? '可读写' : '只读') + '（身份：' + ((data.user || {}).name || '') + '）'
    }
  } catch (e: any) {
    mcpCheck.value = { ok: false, text: e?.message || '连接失败' }
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('已复制')
  } catch (_) { showToast('复制失败，请手动选择复制', 'error') }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(freshToken.value)
    showToast('已复制')
  } catch (_) { showToast('复制失败，请手动选择复制', 'error') }
}

async function doRevoke(id: number) {
  try {
    await revokeApiToken(id)
    showToast('已吊销')
    await loadAccess()
  } catch (e: any) { showToast(e?.message || '吊销失败', 'error') }
}

async function loadBot() {
  if (!canManageChannel.value) return
  try {
    bot.value = await getBotLogin()
  } catch (_) { /* 忽略 */ }
}

async function startBot() {
  botBusy.value = true
  try {
    const res = await startBotLogin()
    if (res?.qrDataUrl) {
      bot.value = Object.assign({}, bot.value, res)
      startBotPolling()
    } else {
      showToast('二维码生成失败，请重试', 'error')
    }
  } catch (e: any) {
    showToast(e?.message || '生成二维码失败', 'error')
  } finally {
    botBusy.value = false
  }
}

function startBotPolling() {
  stopBotPolling()
  botPolling.value = true
  botTimer = setInterval(async () => {
    try {
      const res = await pollBotLogin()
      const st = res?.status
      bot.value = Object.assign({}, bot.value, res)
      if (st === 'confirmed') {
        stopBotPolling()
        showToast('微信已连接')
      } else if (st === 'expired' || st === 'none') {
        stopBotPolling()
        if (st === 'expired') showToast('二维码已过期，请重新生成', 'error')
      }
    } catch (_) { /* 网络抖动继续轮询 */ }
  }, 2500)
}

function stopBotPolling() {
  botPolling.value = false
  if (botTimer) { clearInterval(botTimer); botTimer = null }
}
</script>

<template>
  <div class="agent-page">
    <NavBar title="办事助手" />

    <div ref="scroller" class="chat">
      <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
        <div class="bubble" :class="{ md: m.role === 'assistant' }">
          <div v-if="m.content" v-html="m.role === 'assistant' ? renderMarkdown(m.content) : escapeText(m.content)"></div>
          <!-- 会话图片：缩略显示只拉 480px 缩略图；点开进查看器看中图，同一批可左右滑动 -->
          <div v-if="m.attachments && m.attachments.length" class="thumbs">
            <img
              v-for="(a, ai) in m.attachments"
              :key="ai"
              :src="mediaUrl(thumbUrl(a.url))"
              :alt="a.name || '图片'"
              loading="lazy"
              decoding="async"
              @error="onThumbError($event, a.url)"
              @click="openMessageImage(m, ai)"
            />
          </div>
        </div>
      </div>

      <div v-if="pending" class="confirm-card" :class="{ expired: pendingExpired }">
        <div class="confirm-title">
          待确认操作
          <span class="confirm-ttl">{{ pendingExpired ? '已过期' : `剩余 ${pendingLeftText}` }}</span>
        </div>
        <div class="confirm-body">{{ pending.label }}</div>
        <div class="confirm-preview">{{ pending.preview }}</div>
        <div v-if="pendingExpired" class="confirm-expired-hint">
          确认卡片有效期 5 分钟，已过期。请重新对助手说一遍你要办的事。
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" :disabled="sending" @click="cancelAction">取消</button>
          <button class="btn-primary" :disabled="sending || pendingExpired" @click="confirmAction">确认执行</button>
        </div>
      </div>

      <div v-if="sending" class="row assistant"><div class="bubble typing">正在处理…</div></div>
    </div>

    <div v-if="showSuggestions" class="quick">
      <button v-for="s in suggestions" :key="s" class="chip" type="button" @click="send(s)">{{ s }}</button>
    </div>

    <div v-if="attachments.length" class="attach-row">
      <div v-for="(a, i) in attachments" :key="i" class="attach-item">
        <!-- 待发送图片：56px 小图只拉缩略图；点开进查看器，同一批可左右滑动 -->
        <img
          :src="mediaUrl(thumbUrl(a.url))"
          :alt="a.name || '图片'"
          loading="lazy"
          decoding="async"
          @error="onThumbError($event, a.url)"
          @click="openPendingImage(i)"
        />
        <span class="attach-x" @click="removeAttachment(i)"><AppIcon name="close" :size="12" /></span>
      </div>
    </div>

    <div class="composer">
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFiles" />
      <button class="icon-btn" :disabled="uploading" title="发送图片" @click="pickFile">
        {{ uploading ? '…' : '🖼' }}
      </button>
      <button class="icon-btn" :class="{ on: listening }" title="语音输入" @click="startVoice">🎤</button>
      <textarea
        v-model="input"
        rows="1"
        placeholder="说点什么，例如：我要请明天的早操假"
        @keyup.enter.exact.prevent="send()"
      ></textarea>
      <button class="send" :disabled="sending || (!input.trim() && !attachments.length)" @click="send()">发送</button>
    </div>

    <div class="action-bar">
      <button class="action-btn" @click="sheet = 'tools'">
        <AppIcon name="grid" :size="16" />
        <span>能力清单</span>
      </button>
      <button class="action-btn" @click="sheet = 'access'">
        <AppIcon name="link" :size="16" />
        <span>微信 / MCP 接入</span>
      </button>
    </div>

    <!-- 抽屉：能力清单 -->
    <div v-if="sheet" class="sheet-mask" @click.self="sheet = null">
      <div class="sheet">
        <div class="sheet-head">
          <span>{{ sheet === 'tools' ? '我能办哪些事（' + modules.length + ' 个模块）' : '微信助手 / MCP 接入' }}</span>
          <button class="sheet-close" @click="sheet = null">关闭</button>
        </div>

        <div v-if="sheet === 'tools'" class="sheet-body">
          <div v-if="toolsError" class="tools-error">
            <p>能力清单加载失败，可能是网络问题。</p>
            <button class="btn-ghost" type="button" @click="loadTools">重新加载</button>
          </div>
          <div v-else-if="modules.length === 0" class="tools-error">
            <p>暂无可用能力（可能尚未配置）。你仍然可以直接对话。</p>
          </div>
          <div v-for="m in modules" :key="m.name" class="tool-item">
            <div class="tool-name">{{ m.label }}</div>
            <div class="tool-desc">{{ m.description }}</div>
          </div>
        </div>

        <div v-else class="sheet-body">
          <div v-if="canManageChannel" class="acc-block">
            <div class="acc-title">连接微信机器人（管理员）</div>
            <div v-if="bot && bot.connected" class="acc-hint">
              已连接：{{ bot.accountId }} · 服务状态：{{ bot.worker || 'unknown' }}
              <template v-if="bot.worker && bot.worker !== 'active'">（未在运行：请确认已安装 class-mansys-ilink 服务单元）</template>
            </div>
            <div v-else class="acc-hint">
              这一步只需做一次：扫码后，系统就拥有了一个「微信里的助手」身份，同学私聊它即可办事。
            </div>
            <div v-if="bot && bot.qrDataUrl && bot.status !== 'confirmed'" class="qr-box">
              <img :src="bot.qrDataUrl" alt="微信扫码" loading="lazy" decoding="async" />
              <div class="acc-hint">
                <template v-if="bot.status === 'scaned'">已扫码，请在手机上点击确认…</template>
                <template v-else>请用微信扫码（约 5 分钟内有效）</template>
              </div>
            </div>
            <div class="acc-row">
              <button class="btn-primary" :disabled="botBusy || botPolling" @click="startBot">
                {{ bot && bot.connected ? '重新扫码（更换机器人身份）' : (botPolling ? '等待扫码…' : '生成二维码并连接') }}
              </button>
              <button v-if="botPolling" class="btn-ghost" @click="stopBotPolling">停止</button>
            </div>
          </div>

          <div class="acc-block">
            <div class="acc-title">绑定我的微信</div>
            <div class="acc-hint">
              绑定后可直接在微信私聊里办事（请假、报销、提建议）。目前仅支持私聊。
            </div>
            <div ref="bindCodeRef" class="bind-box">
              <div v-if="!bindCode" class="acc-row">
                <button class="btn-primary" @click="genBindCode">生成绑定码</button>
              </div>
              <template v-else>
                <div class="acc-row">
                  <span class="code">{{ bindCode }}</span>
                  <span class="acc-hint">剩余 {{ Math.floor(bindCodeLeft / 60) }}:{{ String(bindCodeLeft % 60).padStart(2, '0') }}</span>
                </div>
                <div class="acc-hint">在微信里给助手发：<b>/绑定 {{ bindCode }}</b></div>
                <div class="acc-row">
                  <button class="btn-ghost" @click="copyText('/绑定 ' + bindCode)">复制口令</button>
                  <button class="btn-ghost" @click="genBindCode">重新生成</button>
                </div>
              </template>
            </div>
            <div v-if="bindings.length" class="acc-list">
              <div v-for="b in bindings" :key="b.id" class="acc-item">
                <span>{{ b.channel === 'weixin' ? '微信' : b.channel }} · {{ b.display_name || b.external_id }}</span>
                <button class="btn-ghost" @click="doUnbind(b.id)">解绑</button>
              </div>
            </div>
          </div>

          <div class="acc-block">
            <div class="acc-title">MCP 令牌（让你自己的 AI 助手接进来）</div>
            <div class="acc-hint">
              <span class="help-link" @click="router.push('/pages/help/index')">📖 不会配置？看用户手册「MCP：让你自己的 AI 助手接入」</span>
            </div>
            <div class="acc-hint">
              令牌 = <b>你在本系统的身份副本</b>：把它交给你自己的 AI 客户端（Claude Desktop / Cursor / DSH / 任何支持 MCP 的 agent），
              对方就能替你查请假、考勤、账单，甚至提交请假（需你二次确认）。<br />
              三步：① 生成令牌 → ② 复制下面的配置 → ③ 粘贴进客户端的 MCP 设置。<br />
              令牌只显示一次，服务端只存哈希；随时可吊销。默认<b>只读</b>。
            </div>
            <div class="acc-row">
              <input v-model="newTokenName" class="acc-input" placeholder="令牌备注，如：我的电脑" />
              <button class="btn-primary" @click="genToken">生成令牌</button>
            </div>
            <label class="acc-check">
              <input v-model="newTokenWrite" type="checkbox" />
              <span>允许写操作（请假、报销、建议等；每次仍需你在会话里确认后才会落库）</span>
            </label>

            <div v-if="freshToken" ref="tokenBoxRef" class="token-box">
              <div class="token-head">
                <span class="acc-hint"><b>你的令牌（只显示这一次）</b></span>
                <button class="btn-ghost" @click="dismissFreshToken">我已保存，收起</button>
              </div>
              <div class="acc-row token-fresh">
                <code>{{ freshToken }}</code>
                <button class="btn-ghost" @click="copyToken">复制</button>
              </div>
            </div>
            <div v-else class="acc-hint warn">
              已有令牌看不到明文（服务端只存哈希，这是安全设计）。要用下面的提示词，点右上角「生成令牌并复制提示词」——系统会新建一个并自动复制好。
            </div>

            <div class="acc-row">
              <button class="btn-primary" @click="genTokenAndCopyPrompt">生成令牌并复制提示词</button>
            </div>

            <div class="acc-hint">
              <b>要"下载"什么吗？不用。</b>MCP 是协议不是软件：你已有的 AI 客户端（Claude Desktop / Cursor / DSH 等）
              里填一段配置就能用——不需要装 Node、不需要拷代码、不需要数据库。只有客户端"只支持命令行方式"时，
              才需要一次性桥接（第 3 步的提示词里已经写好，让 AI 自己装）。
            </div>

            <div class="acc-hint"><b>方式一（最省事）：把下面这段发给你的 AI，让它自己配好</b></div>
            <div class="code-block">
              <pre>{{ mcpPrompt }}</pre>
              <button class="btn-primary" @click="copyText(mcpPrompt)">复制给 AI 的提示词</button>
            </div>

            <div class="acc-hint"><b>方式二：手动粘配置（HTTP）</b></div>
            <div class="code-block">
              <pre>{{ mcpConfig }}</pre>
              <button class="btn-ghost" @click="copyText(mcpConfig)">复制配置</button>
            </div>

            <div class="acc-hint">连接地址：{{ mcpEndpoint }}</div>
            <div class="acc-row">
              <button class="btn-ghost" :disabled="!freshToken" @click="checkMcp">连接自检</button>
              <span v-if="mcpCheck" class="acc-hint" :class="{ bad: !mcpCheck.ok }">{{ mcpCheck.text }}</span>
              <span v-else-if="!freshToken" class="acc-hint">（自检需要刚生成的令牌明文；也可直接用提示词让 AI 验证）</span>
            </div>

            <details class="acc-details">
              <summary class="acc-hint">方式三：stdio（仅当客户端与服务器在同一台机器；需要本机有仓库和 Node）</summary>
              <div class="code-block">
                <pre>{{ mcpStdioConfig }}</pre>
                <button class="btn-ghost" @click="copyText(mcpStdioConfig)">复制配置</button>
              </div>
            </details>
            <div v-if="tokens.length" class="acc-list">
              <div v-for="t in tokens" :key="t.id" class="acc-item">
                <span>
                  {{ t.name || '未命名' }} · {{ t.prefix }}…
                  <span class="tag" :class="{ write: !!t.allow_write }">{{ t.allow_write ? '读写' : '只读' }}</span>
                  （{{ t.last_used_at ? '最近使用 ' + t.last_used_at : '未使用' }}）
                </span>
                <button class="btn-ghost" @click="doRevoke(t.id)">吊销</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片查看器：公共组件（中图分级加载 + 失败回退、滑动/键盘/滚动锁都在组件内） -->
    <ImageViewer v-model="viewerOpen" :images="viewerImages" :start-index="viewerStart" />
  </div>
</template>

<style scoped>
.confirm-ttl { float: right; font-size: var(--font-size-2xs); font-weight: 500; color: var(--color-text-3); }
.confirm-card.expired { border-color: var(--color-error); }
.confirm-card.expired .confirm-ttl { color: var(--color-error); }
.confirm-expired-hint {
  margin-top: 8px; font-size: var(--font-size-xs); line-height: 1.5;
  color: var(--color-error);
}
.tools-error { padding: 16px 4px; text-align: center; color: var(--color-text-3); font-size: var(--font-size-sm); }
.tools-error p { margin-bottom: 10px; }

/* 页面固定高度：聊天区自己滚动，底部输入区永远可见（TabBar 高度已扣除） */
.agent-page {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 50px - env(safe-area-inset-bottom, 0px)); /* 50px = TabBar 高度 */
  background: var(--color-bg);
}
.chat { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 12px 4px; }
.row { display: flex; margin-bottom: 10px; }
.row.user { justify-content: flex-end; }
.bubble {
  max-width: 84%; padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.6;
  background: var(--color-surface); color: var(--color-text); box-shadow: var(--shadow-card);
  white-space: pre-wrap; word-break: break-word;
}
.bubble.md { white-space: normal; }
.row.user .bubble { background: var(--color-accent); color: #fff; }
.bubble.typing { color: var(--color-text-3); }
.thumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.thumbs img { width: 92px; height: 92px; object-fit: cover; border-radius: 8px; cursor: pointer; }

/* Markdown 排版 */
.bubble.md :deep(h1), .bubble.md :deep(h2), .bubble.md :deep(h3) { font-size: 15px; margin: 8px 0 4px; }
.bubble.md :deep(p) { margin: 4px 0; }
.bubble.md :deep(ul), .bubble.md :deep(ol) { margin: 4px 0 4px 18px; padding: 0; }
.bubble.md :deep(li) { margin: 2px 0; }
.bubble.md :deep(code) { background: var(--color-surface-hover); padding: 1px 4px; border-radius: 4px; font-size: 12px; }
.bubble.md :deep(pre) { background: var(--color-surface-hover); padding: 8px; border-radius: 8px; overflow-x: auto; }
.bubble.md :deep(img) { max-width: 100%; border-radius: 8px; margin: 4px 0; }
.bubble.md :deep(a) { color: var(--color-accent); }
.bubble.md :deep(table) { border-collapse: collapse; font-size: 13px; }
.bubble.md :deep(th), .bubble.md :deep(td) { border: 1px solid var(--color-border); padding: 4px 6px; }

.confirm-card {
  margin: 8px 0 14px; padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card); border-left: 3px solid var(--color-warning);
}
.confirm-title { font-size: 13px; font-weight: 600; color: var(--color-warning); margin-bottom: 6px; }
.confirm-body { font-size: 14px; color: var(--color-text); margin-bottom: 4px; }
.confirm-preview { font-size: 12px; color: var(--color-text-3); word-break: break-all; margin-bottom: 10px; }
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }

.quick { display: flex; gap: 6px; overflow-x: auto; padding: 6px 12px; flex: 0 0 auto; }
.chip {
  flex: 0 0 auto; min-height: 36px; display: inline-flex; align-items: center;
  font-size: var(--font-size-xs); padding: 8px 12px; border-radius: var(--radius-full);
  border: none; font-family: inherit;
  background: var(--color-accent-bg); color: var(--color-accent); cursor: pointer; white-space: nowrap;
}
.chip:active { opacity: 0.85; }
.attach-row { display: flex; gap: 8px; padding: 6px 12px 0; overflow-x: auto; flex: 0 0 auto; }
.attach-item { position: relative; flex: 0 0 auto; }
.attach-item img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; cursor: pointer; }
.attach-x {
  position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 9px;
  background: var(--color-danger, var(--color-error)); color: #fff; font-size: 11px; line-height: 18px; text-align: center; cursor: pointer;
}
.composer { display: flex; gap: 6px; padding: 8px 12px; align-items: flex-end; flex: 0 0 auto; }
.composer textarea {
  flex: 1; resize: none; min-height: 40px; max-height: 110px; padding: 10px 12px; font-size: 14px;
  border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface);
  color: var(--color-text); font-family: inherit;
}
.icon-btn {
  width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--color-border);
  background: var(--color-surface); cursor: pointer; font-size: 17px; flex: 0 0 auto;
}
.icon-btn.on { border-color: var(--color-accent); background: var(--color-accent-bg); }
.send { height: 40px; padding: 0 16px; border: none; border-radius: 10px; background: var(--color-accent); color: #fff; font-size: 14px; cursor: pointer; flex: 0 0 auto; }
.send:disabled { opacity: 0.5; }

.action-bar { display: flex; gap: 8px; padding: 0 12px 10px; flex: 0 0 auto; }
.action-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 40px; font-size: 13px; font-weight: 500; cursor: pointer;
  color: var(--color-text-2); background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: 10px;
}
.action-btn:active { background: var(--color-surface-hover); }
.action-icon { font-size: 15px; }

/* 抽屉 */
.sheet-mask {
  position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  width: 100%; max-width: 900px; max-height: 78dvh; display: flex; flex-direction: column;
  background: var(--color-surface); border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0px);
}
.sheet-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--color-border); font-size: 15px; font-weight: 600; color: var(--color-text);
}
.sheet-close { border: none; background: transparent; color: var(--color-accent); font-size: 14px; cursor: pointer; }
.sheet-body { overflow-y: auto; padding: 8px 16px 20px; }
.tool-item { padding: 10px 0; border-bottom: 1px solid var(--color-border); }
.tool-name { font-size: 13px; font-weight: 600; color: var(--color-text); }
.tool-desc { font-size: 12px; color: var(--color-text-3); margin-top: 2px; }

.acc-block { padding: 12px 0 16px; border-bottom: 1px solid var(--color-border); }
.acc-title { font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.acc-hint { font-size: 12px; color: var(--color-text-3); line-height: 1.6; margin-bottom: 8px; }
.acc-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.acc-input {
  flex: 1; min-width: 140px; height: 36px; padding: 0 10px; font-size: 13px;
  border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text);
}
.code { font-size: 22px; font-weight: 700; letter-spacing: 3px; color: var(--color-accent); }
.qr-box { text-align: center; margin: 6px 0 10px; }
.qr-box img { width: 220px; height: 220px; background: #fff; border-radius: 12px; padding: 6px; }
.token-fresh code { flex: 1; font-size: 11px; word-break: break-all; color: var(--color-text-2); }
.acc-check { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--color-text-3); line-height: 1.5; margin-bottom: 10px; }
.acc-check input { margin-top: 2px; }
.token-box { border: 1px dashed var(--color-accent); border-radius: 10px; padding: 10px; margin-bottom: 10px; background: var(--color-accent-bg); }
.token-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.bind-box:empty { display: none; }
.code-block { position: relative; margin-bottom: 8px; }
.code-block pre {
  margin: 0; padding: 10px; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;
  background: var(--color-surface-hover); border-radius: 8px; color: var(--color-text-2); max-height: 190px; overflow: auto;
}
.code-block .btn-ghost { margin-top: 6px; }
.acc-details summary { cursor: pointer; margin-bottom: 8px; }
.acc-hint.bad { color: var(--color-danger, var(--color-error)); }
.acc-hint.warn { color: var(--color-warning); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.tag { display: inline-block; padding: 0 5px; border-radius: 6px; background: var(--color-surface-hover); color: var(--color-text-3); }
.tag.write { background: var(--color-accent-bg); color: var(--color-accent); }
.help-link { color: var(--color-accent); cursor: pointer; }
.acc-list { margin-top: 4px; }
.acc-item {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  font-size: 12px; color: var(--color-text-2); padding: 6px 0;
}
.btn-primary, .btn-ghost { padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; border: none; }
.btn-primary { background: var(--color-accent); color: #fff; }
.btn-primary:disabled { opacity: 0.6; }
.btn-ghost { background: var(--color-surface-hover); color: var(--color-text-2); }
</style>
