<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'
import { apiUrl, getToken } from '@/utils/request'
import { renderMarkdown } from '@/utils/markdown'
import { mediaUrl, openMedia } from '@/utils/media'
import { useUserStore } from '@/stores/user'
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
  type AgentMessage,
  type AgentPendingAction,
  type AgentAttachment,
  type AgentToolModule,
  type AgentApiToken,
  type WechatBinding,
  type WechatBotStatus,
} from '@/api/agent'

const MAX_ATTACHMENTS = 6
const SUGGESTIONS = ['我的请假记录', '我要请假', '怎么请假？', '今天中队出勤怎么样', '给个建议：']

type UiMessage = AgentMessage & { attachments?: AgentAttachment[] }

const messages = ref<UiMessage[]>([])
const input = ref('')
const sending = ref(false)
const uploading = ref(false)
const conversationId = ref<number | undefined>(undefined)
const pending = ref<AgentPendingAction | null>(null)
const modules = ref<AgentToolModule[]>([])
const sheet = ref<'tools' | 'access' | null>(null)
const scroller = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const listening = ref(false)
const attachments = ref<AgentAttachment[]>([])

const userStore = useUserStore()
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
const freshToken = ref('')
let bindTimer: any = null

onMounted(async () => {
  try {
    const res = await getAgentTools()
    if (res?.success) modules.value = res.data?.modules || []
  } catch (_) { /* 无权限时仍可对话 */ }
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
async function chatStreaming(content: string): Promise<{ reply: string; pendingAction?: AgentPendingAction | null; conversationId?: number } | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(apiUrl('/api/agent/chat/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ message: content, conversationId: conversationId.value, attachments: attachments.value }),
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
  const content = (text ?? input.value).trim()
  const atts = attachments.value.slice()
  if ((!content && !atts.length) || sending.value) return
  messages.value.push({ role: 'user', content, attachments: atts })
  input.value = ''
  attachments.value = []
  sending.value = true
  await scrollToBottom()
  try {
    const streamed = await chatStreaming(content)
    if (streamed) {
      if (streamed.conversationId) conversationId.value = streamed.conversationId
      pending.value = streamed.pendingAction || null
    } else {
      const res = await agentChat(content, conversationId.value, atts)
      if (res?.conversationId) conversationId.value = res.conversationId
      if (res?.reply) messages.value.push({ role: 'assistant', content: res.reply })
      pending.value = res?.pendingAction || null
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
    if (b?.success) bindings.value = b.bindings || []
    if (t?.success) tokens.value = (t.tokens || []).filter((x) => !x.revoked_at)
  } catch (_) { /* 忽略 */ }
}

async function genBindCode() {
  try {
    const res = await issueBindCode()
    if (res?.success) {
      bindCode.value = res.code
      bindCodeLeft.value = res.expiresInSec || 900
      if (bindTimer) clearInterval(bindTimer)
      bindTimer = setInterval(() => {
        bindCodeLeft.value -= 1
        if (bindCodeLeft.value <= 0) { clearInterval(bindTimer); bindCode.value = '' }
      }, 1000)
    }
  } catch (e: any) { showToast(e?.message || '生成失败', 'error') }
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
    const res = await createApiToken(newTokenName.value.trim() || '我的智能体')
    if (res?.success) {
      freshToken.value = res.token
      newTokenName.value = ''
      await loadAccess()
    }
  } catch (e: any) { showToast(e?.message || '创建失败', 'error') }
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
    const res = await getBotLogin()
    if (res?.success) bot.value = res.data
  } catch (_) { /* 忽略 */ }
}

async function startBot() {
  botBusy.value = true
  try {
    const res = await startBotLogin()
    if (res?.success) {
      bot.value = Object.assign({}, bot.value, res.data)
      startBotPolling()
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
      const st = res?.data?.status
      bot.value = Object.assign({}, bot.value, res.data)
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
          <div v-if="m.attachments && m.attachments.length" class="thumbs">
            <img
              v-for="(a, ai) in m.attachments"
              :key="ai"
              :src="mediaUrl(a.url)"
              :alt="a.name || '图片'"
              @click="openMedia(a.url)"
            />
          </div>
        </div>
      </div>

      <div v-if="pending" class="confirm-card">
        <div class="confirm-title">待确认操作</div>
        <div class="confirm-body">{{ pending.label }}</div>
        <div class="confirm-preview">{{ pending.preview }}</div>
        <div class="confirm-actions">
          <button class="btn-ghost" :disabled="sending" @click="cancelAction">取消</button>
          <button class="btn-primary" :disabled="sending" @click="confirmAction">确认执行</button>
        </div>
      </div>

      <div v-if="sending" class="row assistant"><div class="bubble typing">正在处理…</div></div>
    </div>

    <div class="quick">
      <span v-for="s in SUGGESTIONS" :key="s" class="chip" @click="send(s)">{{ s }}</span>
    </div>

    <div v-if="attachments.length" class="attach-row">
      <div v-for="(a, i) in attachments" :key="i" class="attach-item">
        <img :src="mediaUrl(a.url)" :alt="a.name || '图片'" />
        <span class="attach-x" @click="removeAttachment(i)">✕</span>
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
        <span class="action-icon">🧰</span>
        <span>能力清单</span>
      </button>
      <button class="action-btn" @click="sheet = 'access'">
        <span class="action-icon">🔗</span>
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
              <img :src="bot.qrDataUrl" alt="微信扫码" />
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
            <div v-if="!bindCode" class="acc-row">
              <button class="btn-primary" @click="genBindCode">生成绑定码</button>
            </div>
            <div v-else class="acc-row">
              <span class="code">{{ bindCode }}</span>
              <span class="acc-hint">剩余 {{ Math.floor(bindCodeLeft / 60) }}:{{ String(bindCodeLeft % 60).padStart(2, '0') }}</span>
            </div>
            <div v-if="bindCode" class="acc-hint">在微信里给助手发：<b>/绑定 {{ bindCode }}</b></div>
            <div v-if="bindings.length" class="acc-list">
              <div v-for="b in bindings" :key="b.id" class="acc-item">
                <span>{{ b.channel === 'weixin' ? '微信' : b.channel }} · {{ b.display_name || b.external_id }}</span>
                <button class="btn-ghost" @click="doUnbind(b.id)">解绑</button>
              </div>
            </div>
          </div>

          <div class="acc-block">
            <div class="acc-title">MCP 令牌（给你的 agent 用）</div>
            <div class="acc-hint">
              生成令牌后可在你自己的 AI 客户端（Claude Desktop / Cursor / DSH 等）里接入本系统，读取你的请假、考勤、账单等数据；令牌等同你的身份，请勿外传。默认只读。
            </div>
            <div class="acc-row">
              <input v-model="newTokenName" class="acc-input" placeholder="令牌备注，如：我的电脑" />
              <button class="btn-primary" @click="genToken">生成令牌</button>
            </div>
            <div v-if="freshToken" class="acc-row token-fresh">
              <code>{{ freshToken }}</code>
              <button class="btn-ghost" @click="copyToken">复制</button>
            </div>
            <div v-if="freshToken" class="acc-hint">该令牌只显示这一次，请立即保存。</div>
            <div v-if="tokens.length" class="acc-list">
              <div v-for="t in tokens" :key="t.id" class="acc-item">
                <span>{{ t.name || '未命名' }} · {{ t.prefix }}…（{{ t.last_used_at ? '最近使用 ' + t.last_used_at : '未使用' }}）</span>
                <button class="btn-ghost" @click="doRevoke(t.id)">吊销</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  margin: 8px 0 14px; padding: 12px 14px; border-radius: 12px;
  background: var(--color-surface); box-shadow: var(--shadow-card); border-left: 3px solid var(--color-warning);
}
.confirm-title { font-size: 13px; font-weight: 600; color: var(--color-warning); margin-bottom: 6px; }
.confirm-body { font-size: 14px; color: var(--color-text); margin-bottom: 4px; }
.confirm-preview { font-size: 12px; color: var(--color-text-3); word-break: break-all; margin-bottom: 10px; }
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }

.quick { display: flex; gap: 6px; overflow-x: auto; padding: 6px 12px; flex: 0 0 auto; }
.chip {
  flex: 0 0 auto; font-size: 12px; padding: 5px 10px; border-radius: 12px;
  background: var(--color-accent-bg); color: var(--color-accent); cursor: pointer; white-space: nowrap;
}
.attach-row { display: flex; gap: 8px; padding: 6px 12px 0; overflow-x: auto; flex: 0 0 auto; }
.attach-item { position: relative; flex: 0 0 auto; }
.attach-item img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; }
.attach-x {
  position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 9px;
  background: var(--color-danger, #e5484d); color: #fff; font-size: 11px; line-height: 18px; text-align: center; cursor: pointer;
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
