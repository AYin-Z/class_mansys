<script setup lang="ts">
/**
 * 全屏图片查看器（2026-09 统一）
 *
 * 为什么抽出来：相册详情与请假（详情/审批）此前各写了一份全屏查看器，
 * 助手聊天与擂台证明则是 `window.open()` 新开浏览器标签看原图 ——
 * 手机上离开应用、装成 APK 后可能没反应，而且加载的是 3–6MB 原图。
 *
 * 统一后的行为：
 *  - Teleport 到 body：不再被父级 stacking context 裁切（此前页面头部会透出来）
 *  - 纯黑不透明底 + 安全区适配
 *  - 左右滑动切换（横向位移 ≥40px 且横向优先）、相邻两张预加载
 *  - 键盘：← → 切换、Esc 关闭；关闭按钮 44px
 *  - 分级加载：默认显示 1440px 中图（200–400KB），失败回退原图；保存/下载才用原图
 *  - 可选删除（由父组件决定某张是否可删），破坏性确认交给父组件
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { downloadMedia, mediumUrl, mediaUrl, neighborIndexes, onThumbError, preloadImage } from '@/utils/media'

export interface ViewerImage {
  /** 原图（保存/下载、以及中图缺失时的回退） */
  url: string
  /** 可选：自定义中图；不传按 `_medium` 约定推导 */
  mediumUrl?: string | null
  /** 可选：自定义缩略图（预加载占位用） */
  thumbUrl?: string | null
  title?: string
  description?: string
  /** 是否允许删除（父组件按权限计算） */
  deletable?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  images: ViewerImage[]
  startIndex?: number
  /** 是否显示「保存原图」 */
  showSave?: boolean
  deleteText?: string
  /** 关闭按钮位置：默认左上（相册/请假沿用），可改右上 */
  closePosition?: 'left' | 'right'
}>(), {
  startIndex: 0,
  showSave: true,
  deleteText: '删除',
  closePosition: 'left',
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  /** 删除某张：父组件负责二次确认与调用接口，成功后再改 images */
  delete: [image: ViewerImage, index: number]
  change: [index: number]
}>()

const index = ref(0)
const touchStart = ref<{ x: number; y: number } | null>(null)

const total = computed(() => props.images.length)
const current = computed<ViewerImage | null>(() => props.images[index.value] || null)
const hasMultiple = computed(() => total.value > 1)

/** 查看用图：优先中图，缺失时 <img @error> 会回退到原图 */
const displaySrc = computed(() => {
  const img = current.value
  if (!img) return ''
  return mediaUrl(img.mediumUrl || mediumUrl(img.url))
})

function clampIndex(i: number) {
  if (!total.value) return 0
  return Math.max(0, Math.min(total.value - 1, i))
}

function close() {
  emit('update:modelValue', false)
}

function go(delta: number) {
  if (!hasMultiple.value) return
  index.value = (index.value + delta + total.value) % total.value
  emit('change', index.value)
}

function goto(i: number) {
  index.value = clampIndex(i)
  emit('change', index.value)
}

/** 预加载相邻两张中图，滑动过去不需要等 */
function preloadNeighbors() {
  for (const i of neighborIndexes(index.value, total.value)) {
    const img = props.images[i]
    if (!img) continue
    preloadImage(mediaUrl(img.mediumUrl || mediumUrl(img.url)))
  }
}

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0]
  if (t) touchStart.value = { x: t.clientX, y: t.clientY }
}

function onTouchEnd(e: TouchEvent) {
  const start = touchStart.value
  touchStart.value = null
  if (!start) return
  const t = e.changedTouches[0]
  if (!t) return
  const dx = t.clientX - start.x
  const dy = t.clientY - start.y
  // 横向优先且位移足够，避免误触（下滑关闭之类的行为不在此处理）
  if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return
  go(dx < 0 ? 1 : -1)
}

function onKey(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
}

function save() {
  if (!current.value) return
  downloadMedia(current.value.url)
}

function onImgError(e: Event) {
  if (current.value) onThumbError(e, current.value.url)
}

/** 打开时锁滚动、绑定键盘；关闭/卸载时恢复 */
function sync(open: boolean) {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
}

watch(() => props.modelValue, (open) => {
  if (open) {
    index.value = clampIndex(props.startIndex)
    void nextTick(() => preloadNeighbors())
  }
  sync(open)
}, { immediate: true })

watch(index, () => preloadNeighbors())

/**
 * images 变化时（父组件删除图片后）把下标夹回合法范围。
 * 否则 index 可能指向已不存在的项，current 为空 → 整个查看器渲染成一片黑。
 * 删除后优先停留在"原位置"，即原来的下一张。
 */
watch(() => props.images.length, (len) => {
  if (!len) {
    if (props.modelValue) close()
    return
  }
  if (index.value > len - 1) {
    index.value = len - 1
    emit('change', index.value)
  }
})

onBeforeUnmount(() => {
  sync(false)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && current"
      class="viewer"
      role="dialog"
      aria-modal="true"
      aria-label="图片查看"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <div class="viewer-top" :class="{ 'close-right': closePosition === 'right' }">
        <button
          v-if="closePosition === 'left'"
          class="viewer-btn"
          type="button"
          aria-label="关闭"
          @click="close"
        >
          <AppIcon name="close" :size="20" />
        </button>
        <div v-else class="viewer-spacer" aria-hidden="true" />

        <div class="viewer-counter">
          <template v-if="hasMultiple">{{ index + 1 }} / {{ total }}</template>
          <template v-else>{{ current.title || '' }}</template>
        </div>

        <button
          v-if="closePosition === 'right'"
          class="viewer-btn"
          type="button"
          aria-label="关闭"
          @click="close"
        >
          <AppIcon name="close" :size="20" />
        </button>
        <div v-else class="viewer-spacer" aria-hidden="true" />
      </div>

      <div class="viewer-stage">
        <button
          v-if="hasMultiple"
          class="viewer-nav prev"
          type="button"
          aria-label="上一张"
          @click.stop="go(-1)"
        >
          <AppIcon name="chevron-left" :size="22" />
        </button>

        <img
          :key="displaySrc"
          :src="displaySrc"
          class="viewer-img"
          :alt="current.title || current.description || '图片'"
          decoding="async"
          @error="onImgError"
          @click.stop
        />

        <button
          v-if="hasMultiple"
          class="viewer-nav next"
          type="button"
          aria-label="下一张"
          @click.stop="go(1)"
        >
          <AppIcon name="chevron-right" :size="22" />
        </button>
      </div>

      <div class="viewer-bottom">
        <div class="viewer-meta">
          <!-- 父组件可补充额外信息（例如「待审核」角标、位置、日期） -->
          <slot name="meta" :image="current" :index="index" />
          <div v-if="current.title" class="viewer-title">{{ current.title }}</div>
          <div v-if="current.description" class="viewer-desc">{{ current.description }}</div>
          <div v-if="hasMultiple" class="viewer-hint">左右滑动切换照片</div>
        </div>

        <div class="viewer-actions">
          <!-- 父组件可整体替换操作区（例如相册想加"设为封面"） -->
          <slot name="actions" :image="current" :index="index" :save="save" :close="close">
            <button v-if="showSave" class="viewer-action" type="button" @click="save">
              <AppIcon name="download" :size="16" />
              <span>保存原图</span>
            </button>
            <button
              v-if="current.deletable"
              class="viewer-action danger"
              type="button"
              @click="emit('delete', current, index)"
            >
              <AppIcon name="trash" :size="16" />
              <span>{{ deleteText }}</span>
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 100);
  background: #000; /* 纯黑不透明：此前 94% 半透明会让页面头部透出来 */
  color: #fff;
  display: flex;
  flex-direction: column;
  touch-action: pan-y; /* 允许纵向滚动手势交给浏览器，横向用于切图 */
}

.viewer-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 8px 4px;
}
.viewer-top.close-right { justify-content: space-between; }

.viewer-btn {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  cursor: pointer;
}
.viewer-btn:active { background: rgba(255, 255, 255, 0.26); }
.viewer-spacer { width: 44px; flex-shrink: 0; }

.viewer-counter {
  flex: 1;
  text-align: center;
  font-size: var(--font-size-body);
  opacity: 0.88;
  font-variant-numeric: tabular-nums;
}

.viewer-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.viewer-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  -webkit-user-select: none;
  user-select: none;
}

.viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  cursor: pointer;
}
.viewer-nav:active { background: rgba(255, 255, 255, 0.3); }
.viewer-nav.prev { left: 12px; }
.viewer-nav.next { right: 12px; }

.viewer-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
}
.viewer-meta { flex: 1; min-width: 0; }
.viewer-title { font-size: var(--font-size-body); font-weight: 600; }
.viewer-desc {
  font-size: var(--font-size-sm);
  opacity: 0.75;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.viewer-hint { font-size: var(--font-size-xs); opacity: 0.5; margin-top: 4px; }

.viewer-actions { display: flex; gap: 8px; flex-shrink: 0; }
.viewer-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 10px 14px;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.92);
  color: #1f2937;
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.viewer-action:active { opacity: 0.85; }
.viewer-action.danger { background: var(--color-error, #dc2626); color: #fff; }
</style>
