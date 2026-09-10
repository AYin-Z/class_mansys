<script setup lang="ts">
import { ref, computed } from 'vue'
import NavBar from '@/components/ui/NavBar.vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { MANUAL_SECTIONS, type ManualSection, type ManualAudience } from '@/data/manual'

const router = useRouter()
const userStore = useUserStore()

const role = computed(() => (userStore.profile?.role ?? 0) as number)
const isCadre = computed(() => role.value >= 1 && role.value <= 9)
const isSuperAdmin = computed(() => role.value === 8)

const keyword = ref('')
const opened = ref<string[]>([])
const showAll = ref(false)

/** 按角色过滤：学员只看 all，干部加 cadre，超管加 admin */
const visibleSections = computed<ManualSection[]>(() => {
  return MANUAL_SECTIONS.filter((s) => {
    if (s.audience === 'admin' && !isSuperAdmin.value) return false
    if (s.audience === 'cadre' && !isCadre.value && !isSuperAdmin.value) return false
    return true
  })
})

function sectionText(s: ManualSection): string {
  const parts: string[] = [s.title, s.summary, s.keywords || '']
  for (const b of s.blocks) {
    if (b.kind === 'p' || b.kind === 'tip') parts.push(b.text)
    else if (b.kind === 'steps' || b.kind === 'list') parts.push(b.items.join(' '))
    else if (b.kind === 'table') parts.push(b.rows.map((r) => r.join(' ')).join(' '))
    else if (b.kind === 'code') parts.push(b.caption || '', b.text)
  }
  return parts.join(' ')
}

const matched = computed<ManualSection[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return visibleSections.value
  return visibleSections.value.filter((s) => sectionText(s).toLowerCase().includes(kw))
})

const hiddenCount = computed(() => MANUAL_SECTIONS.length - visibleSections.value.length)

function isOpen(id: string): boolean {
  if (keyword.value.trim()) return true
  return opened.value.includes(id)
}

function toggle(id: string) {
  const i = opened.value.indexOf(id)
  if (i > -1) opened.value.splice(i, 1)
  else opened.value.push(id)
}

function expandAll() {
  opened.value = matched.value.map((s) => s.id)
}

function collapseAll() {
  opened.value = []
}

function jumpTo(id: string) {
  if (!isOpen(id)) opened.value.push(id)
  requestAnimationFrame(() => {
    document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function audienceLabel(a: ManualAudience): string {
  return a === 'admin' ? '管理员' : a === 'cadre' ? '干部' : '所有人'
}
</script>

<template>
  <div class="help-page">
    <NavBar title="用户手册" show-back />

    <div class="hero">
      <div class="hero-title">办事不求人，先看手册</div>
      <div class="hero-sub">共 {{ MANUAL_SECTIONS.length }} 章 · 按你的身份显示 {{ visibleSections.length }} 章<template v-if="hiddenCount > 0">（{{ hiddenCount }} 章为干部/管理员专属）</template></div>
      <input v-model="keyword" class="search" placeholder="搜索：请假、班费、微信绑定、MCP、权限…" />
      <div class="hero-actions">
        <button class="mini" @click="expandAll">展开全部</button>
        <button class="mini" @click="collapseAll">收起全部</button>
        <button class="mini" @click="router.push('/pages/agent/index')">直接问助手</button>
      </div>
      <div v-if="!showAll && hiddenCount > 0" class="hero-hint">
        你是{{ isSuperAdmin ? '系统管理员' : isCadre ? '干部' : '学员' }}，部分内容未显示
        <span class="link" @click="showAll = true">（查看章节清单）</span>
      </div>
    </div>

    <!-- 目录 -->
    <div class="toc">
      <div v-for="s in visibleSections" :key="s.id" class="toc-item" @click="jumpTo(s.id)">
        <span class="toc-icon">{{ s.icon }}</span>
        <span class="toc-label">{{ s.title }}</span>
        <span class="toc-aud">{{ audienceLabel(s.audience) }}</span>
      </div>
    </div>

    <div v-if="showAll" class="all-list">
      <div class="all-title">全部章节（含其他身份专属）</div>
      <div v-for="s in MANUAL_SECTIONS" :key="s.id" class="all-item">
        {{ s.icon }} {{ s.title }} <span class="toc-aud">{{ audienceLabel(s.audience) }}</span>
      </div>
    </div>

    <div v-if="!matched.length" class="empty">没有匹配「{{ keyword }}」的内容，换个词试试，或直接问助手。</div>

    <div v-for="s in matched" :id="'sec-' + s.id" :key="s.id" class="card">
      <div class="card-head" @click="toggle(s.id)">
        <span class="card-icon">{{ s.icon }}</span>
        <div class="card-title-box">
          <div class="card-title">{{ s.title }}</div>
          <div class="card-summary">{{ s.summary }}</div>
        </div>
        <span class="card-arrow">{{ isOpen(s.id) ? '−' : '+' }}</span>
      </div>

      <div v-if="isOpen(s.id)" class="card-body">
        <template v-for="(b, bi) in s.blocks" :key="bi">
          <p v-if="b.kind === 'p'" class="p">{{ b.text }}</p>

          <ol v-else-if="b.kind === 'steps'" class="steps">
            <li v-for="(it, i) in b.items" :key="i">{{ it }}</li>
          </ol>

          <ul v-else-if="b.kind === 'list'" class="list">
            <li v-for="(it, i) in b.items" :key="i">{{ it }}</li>
          </ul>

          <div v-else-if="b.kind === 'table'" class="table-wrap">
            <table>
              <thead><tr><th>{{ b.head[0] }}</th><th>{{ b.head[1] }}</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in b.rows" :key="i"><td>{{ r[0] }}</td><td>{{ r[1] }}</td></tr>
              </tbody>
            </table>
          </div>

          <div v-else-if="b.kind === 'tip'" class="tip">{{ b.text }}</div>

          <div v-else-if="b.kind === 'code'" class="code-box">
            <div v-if="b.caption" class="code-caption">{{ b.caption }}</div>
            <pre>{{ b.text }}</pre>
          </div>
        </template>
      </div>
    </div>

    <div class="foot">手册随系统更新；发现问题请在「建议箱」反馈，或直接问助手。</div>
  </div>
</template>

<style scoped>
.help-page { padding-bottom: 90px; min-height: 100vh; background: var(--color-bg); }
.hero { padding: 16px; background: var(--color-surface); margin-bottom: 12px; }
.hero-title { font-size: 18px; font-weight: 700; color: var(--color-text); }
.hero-sub { font-size: 12px; color: var(--color-text-3); margin-top: 4px; }
.search {
  width: 100%; margin-top: 12px; height: 40px; padding: 0 12px; font-size: 14px;
  border: 1px solid var(--color-border); border-radius: 10px;
  background: var(--color-bg); color: var(--color-text); box-sizing: border-box;
}
.hero-actions { display: flex; gap: 8px; margin-top: 10px; }
.mini {
  flex: 1; height: 34px; font-size: 13px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-2);
}
.mini:active { background: var(--color-surface-hover); }
.hero-hint { font-size: 12px; color: var(--color-text-3); margin-top: 10px; }
.link { color: var(--color-accent); cursor: pointer; }

.toc {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 12px;
}
.toc-item {
  display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 999px;
  background: var(--color-surface); border: 1px solid var(--color-border);
  font-size: 12px; color: var(--color-text-2); cursor: pointer;
}
.toc-aud { font-size: 10px; color: var(--color-text-3); }

.all-list { padding: 0 16px 12px; }
.all-title { font-size: 12px; color: var(--color-text-3); margin-bottom: 6px; }
.all-item { font-size: 12px; color: var(--color-text-2); padding: 3px 0; }

.card { background: var(--color-surface); margin: 0 0 12px; border-radius: var(--radius-md, 12px); overflow: hidden; }
.card-head { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px; cursor: pointer; }
.card-head:active { background: var(--color-surface-hover); }
.card-icon { font-size: 18px; }
.card-title-box { flex: 1; }
.card-title { font-size: 15px; font-weight: 600; color: var(--color-text); }
.card-summary { font-size: 12px; color: var(--color-text-3); margin-top: 2px; }
.card-arrow { font-size: 18px; color: var(--color-text-3); }
.card-body { padding: 0 16px 16px; }
.p { font-size: 14px; line-height: 1.75; color: var(--color-text-2); margin: 8px 0; }
.steps, .list { margin: 8px 0 8px 18px; padding: 0; font-size: 14px; line-height: 1.8; color: var(--color-text-2); }
.steps li, .list li { margin: 4px 0; }
.table-wrap { overflow-x: auto; margin: 10px 0; }
table { border-collapse: collapse; font-size: 13px; width: 100%; }
th, td { border: 1px solid var(--color-border); padding: 6px 8px; text-align: left; color: var(--color-text-2); vertical-align: top; }
th { background: var(--color-surface-hover); color: var(--color-text); white-space: nowrap; }
.tip {
  font-size: 13px; line-height: 1.7; color: var(--color-warning); background: var(--color-accent-bg);
  border-left: 3px solid var(--color-warning); border-radius: 8px; padding: 10px 12px; margin: 10px 0;
}
.code-box { margin: 10px 0; }
.code-caption { font-size: 12px; color: var(--color-text-3); margin-bottom: 4px; }
.code-box pre {
  margin: 0; padding: 10px; font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
  background: var(--color-surface-hover); border-radius: 8px; color: var(--color-text-2); overflow-x: auto;
}
.empty { text-align: center; font-size: 13px; color: var(--color-text-3); padding: 24px 16px; }
.foot { text-align: center; font-size: 12px; color: var(--color-text-3); padding: 8px 24px 20px; }
</style>
