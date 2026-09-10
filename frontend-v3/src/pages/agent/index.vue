<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'
import { apiUrl, getToken } from '@/utils/request'
import {
  agentChat,
  agentConfirm,
  getAgentTools,
  issueBindCode,
  listBindings,
  unbindWechat,
  listApiTokens,
  createApiToken,
  revokeApiToken,
  type AgentMessage,
  type AgentPendingAction,
  type AgentToolModule,
  type AgentApiToken,
  type WechatBinding,
} from '@/api/agent'

const messages = ref<AgentMessage[]>([])
const input = ref('')
const sending = ref(false)
const conversationId = ref<number | undefined>(undefined)
const pending = ref<AgentPendingAction | null>(null)
const modules = ref<AgentToolModule[]>([])
const showTools = ref(false)
const scroller = ref<HTMLElement | null>(null)
const listening = ref(false)
const showAccess = ref(false)
const bindCode = ref('')
const bindCodeLeft = ref(0)
const bindings = ref<WechatBinding[]>([])
const tokens = ref<AgentApiToken[]>([])
const newTokenName = ref('')
const freshToken = ref('')
let bindTimer: any = null

async function loadAccess() {
  try {
    const [b, t] = await Promise.all([listBindings(), listApiTokens()])
    if (b?.success) bindings.value = b.bindings || []
    if (t?.success) tokens.value = (t.tokens || []).filter((x) => !x.revoked_at)
  } catch (_) { /* 忽略 */ }
}

function toggleAccess() {
  showAccess.value = !showAccess.value
  if (showAccess.value) loadAccess()
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
const streamSupported = typeof window !== 'undefined' && !!(window as any).fetch

const SUGGESTIONS = ['我的请假记录', '我要请假', '怎么请假？', '今天中队出勤怎么样', '给个建议：']

onMounted(async () => {
  try {
    const res = await getAgentTools()
    if (res?.success) modules.value = res.data?.modules || []
  } catch (_) { /* 无权限时仍可对话 */ }
  messages.value.push({
    role: 'assistant',
    content: '你好，我是区队办事助手。可以直接说要办的事（例如「我要请假」「报销班费」「提个建议」），也可以问我某个功能怎么用（例如「怎么请假？」）。写操作我会先跟你确认再执行。',
  })
})

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

/** SSE 流式对话；失败自动回退到普通接口 */
async function chatStreaming(content: string): Promise<{ reply: string; pendingAction?: AgentPendingAction | null; conversationId?: number } | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(apiUrl('/api/agent/chat/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ message: content, conversationId: conversationId.value }),
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
  if (!content || sending.value) return
  messages.value.push({ role: 'user', content })
  input.value = ''
  sending.value = true
  await scrollToBottom()
  try {
    const streamed = await chatStreaming(content)
    if (streamed) {
      if (streamed.conversationId) conversationId.value = streamed.conversationId
      pending.value = streamed.pendingAction || null
    } else {
      const res = await agentChat(content, conversationId.value)
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

/** Phase C：语音输入（浏览器支持时可用） */
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
</script>

<template>
  <div class="agent-page">
    <NavBar title="办事助手" show-back />

    <div ref="scroller" class="chat">
      <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
        <div class="bubble">{{ m.content || '…' }}</div>
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

      <div v-if="sending && !messages.length" class="row assistant"><div class="bubble typing">正在处理…</div></div>
    </div>

    <div class="quick">
      <span v-for="s in SUGGESTIONS" :key="s" class="chip" @click="send(s)">{{ s }}</span>
    </div>

    <div class="composer">
      <button class="mic" :class="{ on: listening }" title="语音输入" @click="startVoice">🎤</button>
      <textarea v-model="input" rows="1" placeholder="说点什么，例如：我要请明天的早操假" @keyup.enter.exact.prevent="send()"></textarea>
      <button class="send" :disabled="sending || !input.trim()" @click="send()">发送</button>
    </div>

    <div class="tools-toggle" @click="showTools = !showTools">
      {{ showTools ? '收起能力清单' : '我能办哪些事（' + modules.length + ' 个模块）' }}
    </div>
    <div v-if="showTools" class="tools">
      <div v-for="m in modules" :key="m.name" class="tool-item">
        <div class="tool-name">{{ m.label }}</div>
        <div class="tool-desc">{{ m.description }}</div>
      </div>
    </div>

    <div class="tools-toggle" @click="toggleAccess">
      {{ showAccess ? '收起微信 / MCP 接入' : '微信助手 & MCP 接入' }}
    </div>
    <div v-if="showAccess" class="tools access">
      <div class="acc-block">
        <div class="acc-title">微信助手（个人微信）</div>
        <div class="acc-hint">
          绑定后可直接在微信里跟我说话，请假、报销、提建议都在微信完成。目前仅支持私聊（微信群受微信限制暂不支持）。
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
          生成令牌后，可在你自己的 AI 客户端（Claude Desktop / Cursor / DSH 等）里接入本系统，读取你的请假、考勤、账单等数据；令牌等同你的身份，请勿外传。
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
</template>

<style scoped>
.agent-page { display: flex; flex-direction: column; min-height: 100vh; background: var(--color-bg); }
.chat { flex: 1; overflow-y: auto; padding: 12px 12px 4px; }
.row { display: flex; margin-bottom: 10px; }
.row.user { justify-content: flex-end; }
.bubble {
  max-width: 82%; padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.5;
  background: var(--color-surface); color: var(--color-text); box-shadow: var(--shadow-card); white-space: pre-wrap; word-break: break-word;
}
.row.user .bubble { background: var(--color-accent); color: #fff; }
.bubble.typing { color: var(--color-text-3); }
.confirm-card {
  margin: 8px 0 14px; padding: 12px 14px; border-radius: 12px;
  background: var(--color-surface); box-shadow: var(--shadow-card); border-left: 3px solid var(--color-warning);
}
.confirm-title { font-size: 13px; font-weight: 600; color: var(--color-warning); margin-bottom: 6px; }
.confirm-body { font-size: 14px; color: var(--color-text); margin-bottom: 4px; }
.confirm-preview { font-size: 12px; color: var(--color-text-3); word-break: break-all; margin-bottom: 10px; }
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-primary, .btn-ghost { padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; border: none; }
.btn-primary { background: var(--color-accent); color: #fff; }
.btn-ghost { background: var(--color-surface-hover); color: var(--color-text-2); }
.quick { display: flex; gap: 6px; overflow-x: auto; padding: 8px 12px; }
.chip {
  flex: 0 0 auto; font-size: 12px; padding: 4px 10px; border-radius: 12px;
  background: var(--color-accent-bg); color: var(--color-accent); cursor: pointer; white-space: nowrap;
}
.composer { display: flex; gap: 8px; padding: 8px 12px; align-items: flex-end; }
.composer textarea {
  flex: 1; resize: none; min-height: 40px; max-height: 120px; padding: 10px 12px; font-size: 14px;
  border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text); font-family: inherit;
}
.mic {
  width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--color-border);
  background: var(--color-surface); cursor: pointer; font-size: 16px;
}
.mic.on { border-color: var(--color-accent); background: var(--color-accent-bg); }
.send { height: 40px; padding: 0 16px; border: none; border-radius: 10px; background: var(--color-accent); color: #fff; font-size: 14px; cursor: pointer; }
.send:disabled { opacity: 0.5; }
.tools-toggle { text-align: center; font-size: 12px; color: var(--color-text-3); padding: 8px 0 12px; cursor: pointer; }
.tools { padding: 0 12px 20px; }
.tool-item { padding: 8px 0; border-bottom: 1px solid var(--color-border); }
.tool-name { font-size: 13px; font-weight: 600; color: var(--color-text); }
.tool-desc { font-size: 12px; color: var(--color-text-3); margin-top: 2px; }
.access { padding-bottom: 28px; }
.acc-block { padding: 10px 0 14px; border-bottom: 1px solid var(--color-border); }
.acc-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.acc-hint { font-size: 12px; color: var(--color-text-3); line-height: 1.6; margin-bottom: 8px; }
.acc-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.acc-input {
  flex: 1; height: 34px; padding: 0 10px; font-size: 13px; border: 1px solid var(--color-border);
  border-radius: 8px; background: var(--color-surface); color: var(--color-text);
}
.code { font-size: 22px; font-weight: 700; letter-spacing: 3px; color: var(--color-accent); }
.token-fresh code { flex: 1; font-size: 11px; word-break: break-all; color: var(--color-text-2); }
.acc-list { margin-top: 4px; }
.acc-item {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  font-size: 12px; color: var(--color-text-2); padding: 6px 0;
}
</style>
