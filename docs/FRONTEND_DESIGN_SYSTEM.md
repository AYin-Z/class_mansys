# 前端设计系统与交互规范（2026-09）

> 背景：`docs/FRONTEND_PM_AUDIT_2026-09.md` 审计发现 55 个页面、330 处硬编码色值绕过令牌，
> 「主按钮」有 6 种实现，Toast/Confirm 因小程序单位 `rpx` 在 H5 下样式全失效，
> 23 个列表页错误重试入口为 0。本文件是修复后**统一遵循的规范**，新页面请照此写。

## 1. 设计令牌（`src/styles/variables.css`）

只用这些变量，不要在页面里写死色值/字号（审计基线：55 个文件、330 处硬编码）。

| 类别 | 令牌 | 说明 |
|---|---|---|
| 背景 | `--color-bg` `--color-bg-secondary` `--color-surface` `--color-surface-2` `--color-surface-hover` | 明暗两套自动切换 |
| 边框/遮罩 | `--color-border` `--color-overlay` | |
| 品牌 | `--color-primary` `--color-accent` `--color-accent-bg` `--color-accent-hover` | 强调色 `#1d6fe0`（白字 4.77:1） |
| 文字 | `--color-text`(14.7:1) `--color-text-2`(7.6:1) `--color-text-3`(4.83:1) | **禁止**用 `--color-text-3` 配 10–11px 正文 |
| 语义 | `--color-success/-bg` `--color-warning/-bg` `--color-error/-bg` `--color-danger`(=`error` 别名) `--color-info` | `danger` 旧名保留，兼容历史 `var(--color-danger)` |
| 字号 | `--font-size-title/-lg/-md/-body/-sm/-xs/-2xs` | 6 级阶梯替代 23 种字面量 |
| 间距 | `--spacing-xs/sm/md/lg/xl/2xl` = 4/8/12/16/24/32 | |
| 圆角 | `--radius-sm/md/lg/xl/full` = 8/10/14/18/9999 | |
| 阴影 | `--shadow-card` `--shadow-card-hover` `--shadow-lift` `--shadow-modal` | |
| 布局 | `--navbar-h`(48) `--tabbar-h`(56) `--safe-bottom` | 底部避让统一用它，别再手写 80px |
| 层级 | `--z-navbar`(10) `--z-tabbar`(20) `--z-fab`(30) `--z-sheet`(40) `--z-modal`(100) `--z-toast`(99999) | 禁止再随手写 `z-index: 100` |
| 动效 | `--dur-fast`(150ms) `--dur-base`(200ms) `--ease-out` | 尊重 `prefers-reduced-motion`（已在全局处理） |

## 2. 基础组件（`src/components/ui/`）

| 组件 | 用途 | 关键 props / 约定 |
|---|---|---|
| `AppIcon.vue` | 所有图标（替代 emoji） | `name`（60+ 内置名）、`size`、`stroke`、`filled`；颜色跟随 `currentColor` |
| `BaseButton.vue` | 所有按钮 | `variant`: primary/secondary/ghost/danger/text；`size`: lg(46)/md(42)/sm(38)；`block` `loading` `disabled` |
| `BaseModal.vue` | 所有弹窗 | `v-model`、`title`、`danger`、`closeOnOverlay`、`maxWidth`、`#footer` 放按钮；内置 ESC、遮罩点击、body 滚动锁、安全区 |
| `BaseBadge.vue` | 状态标签/徽标 | `variant`: default/success/warning/danger/info/primary；`size` `dot` `solid` |
| `EmptyState.vue` | 空状态 | `icon` `title` `description` `actionText` `actionIcon` `variant`(default/filtered/error) |
| `StateView.vue` | **页面三态容器** | `loading` `error` `empty` `emptyTitle` `emptyDescription` `emptyVariant` `slim`；`@retry` `@empty-action` |
| `FormField.vue` | 表单字段容器 | `label` `required` `error` `hint` `inline`；内部统一输入框样式（已排除 checkbox/radio） |
| `NavBar.vue` | 顶部栏 | `title` `showBack` `fallback` `#right`；返回有兜底（无历史时回首页），点击区 44px |
| `TabBar.vue` | 底部导航 | 图标矢量、按路径前缀高亮、首页/待办角标；高度 `--tabbar-h` |

## 3. 必须遵守的交互规范

### 3.1 页面三态（P0 级要求）
任何依赖网络的页面都必须区分 **加载中 / 失败可重试 / 真的没有数据**：

```vue
<StateView
  :loading="loading"
  :error="error"
  :empty="list.length === 0"
  empty-icon="clipboard"
  empty-title="还没有请假记录"
  empty-description="请假需要干部审批，建议提前 1 天申请"
  empty-action-text="发起请假"
  @retry="load"
  @empty-action="goApply"
>
  <div v-for="item in list" :key="item.id">…</div>
</StateView>
```

- **禁止** `catch (_) {}`：把失败渲染成「暂无数据」会让用户以为业务上真的没有数据。
- 筛选/搜索无结果用 `empty-variant="filtered"`，文案与真空态不同。
- 金额、待办数等**统计值**加载失败时显示 `--` 或「加载失败」，**绝不显示 0**。

### 3.2 错误提示
- 请求层（`utils/request.ts`）已在非 `silent` 失败时统一 toast，并给错误对象打上 `notified`。
- 页面 `catch` 里用 `toastIfNotNotified(e, '兜底文案')`，**不要**再写死「操作失败」覆盖后端的具体原因。
- 文案规范：**动作 + 原因 + 下一步**。例：「审批提交失败：该请假已被其他人处理，请刷新后重试」。
- 网络/超时已中文化：`TIMEOUT`→「请求超时，请检查网络后重试」；`NETWORK`→「网络连接失败…」。

### 3.3 破坏性操作
- 必须二次确认，且文案包含 **对象 + 动作 + 后果**，危险操作用 `danger: true`：
  ```ts
  const ok = await showConfirm('删除通知', `《${title}》`, {
    danger: true, confirmText: '删除', hint: '删除后学员端立即不可见，且无法恢复',
  })
  if (!ok) return
  ```
- 执行期间给按钮 `:loading` 或 `:disabled`，处理函数首行做在途判断（`if (saving.value) return`）。
- 写操作成功必须有 `showToast('…成功', 'success')`。

### 3.4 触控与可达性
- 可点元素 ≥ **44×44px**（图标按钮用透明点击区撑开）。
- 所有有 `@click` 的元素要有 `:active` 视觉反馈。
- 文字对比度 ≥ 4.5:1；次要文字不要小于 12px。
- 图标一律 `AppIcon`，不要用 emoji（跨平台字形漂移、无法着色）。

### 3.5 底部避让
- `App.vue` 已给所有带 TabBar 的页面统一加 `calc(var(--tabbar-h) + safe-area)` 的 padding，
  页面**不要再**写 `padding-bottom: 80px`。
- 悬浮按钮（FAB）用 `bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px)`、`z-index: var(--z-fab)`。

## 4. 新页面检查清单

- [ ] 三态齐全（loading / error+重试 / empty，筛选态用 filtered）
- [ ] 空状态有标题 + 解释 +（能给就给的）CTA
- [ ] 写操作有防重、成功反馈、失败用 `toastIfNotNotified`
- [ ] 破坏性操作有 `showConfirm` 且写明后果
- [ ] 无硬编码色值/字号/z-index；无 `rpx`
- [ ] 按钮用 `BaseButton`，弹窗用 `BaseModal`，标签用 `BaseBadge`，图标用 `AppIcon`
- [ ] 可点元素 ≥44px 且有 `:active`
- [ ] 未手写底部避让；页面在 375 / 414 / 480+ 宽度下不横向溢出
- [ ] `npm run lint && npm run typecheck && npm test` 全绿

## 5. 已知的后续收敛项

- 仍有页面使用自己写的卡片/分隔样式（审计统计：重写 `.card` 18 处、自建 Modal 11 处），
  已替换大部分高频路径，剩余可在后续迭代随功能改动逐步替换。
- `stylelint color-no-hex`（白名单 `variables.css`）尚未接入，接入后能自动拦住新增硬编码色值。
- `StateView`/`EmptyState` 的 variant 类型建议抽成共享类型，避免后续漂移。

### 3.6 看图：统一用 `ImageViewer`

全系统的"点图看大图"统一走 `components/ui/ImageViewer.vue`（2026-09 抽出）：
相册详情、请假详情、请假审批、擂台证明、助手聊天图片。

```vue
<ImageViewer
  v-model="viewerOpen"
  :images="[{ url: p.url, title: p.uploader_name, description: p.description, deletable: canDelete(p) }]"
  :start-index="startIndex"
  @delete="onDelete"          <!-- 父组件负责二次确认 + 调接口 -->
>
  <template #meta="{ image }">…</template>      <!-- 额外信息（如「待审核」角标） -->
  <template #actions="{ save }">…</template>    <!-- 自定义底部操作；不传则用默认 保存原图/删除 -->
</ImageViewer>
```

组件内部已处理（**不要在页面里重复实现**）：
Teleport 到 body（避免被父级 stacking context 裁切）、纯黑不透明底 + 安全区、
左右滑动（横向 ≥40px 且横向优先）、相邻中图预加载、键盘 ←/→/Esc、
打开锁 body 滚动、预览用 1440px 中图（失败回退原图）、保存/下载用原图、
`images` 变短时自动把下标夹回（删图后不会黑屏）、清空时自动关闭。

历史上这里有三种实现（相册一份、请假两份、助手/擂台直接 `window.open` 看几 MB 原图），
新增页面一律用组件，不要再写第二份。
