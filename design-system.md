# 区队管理系统 V2 — 设计系统

## 设计方向

**定调：干净、专业、不花哨。** 这是公安大学的管理系统，不是校园社交 App。

- **双主题切换** — Light（默认白底） / Dark（深海军蓝）
- 内容优先——通知、作业、请假等文本密集型功能
- 移动端优先——学生主要用手机访问
- 所有样式通过 CSS 自定义属性定义，切换在根元素改 `data-theme` 属性

## 双主题色板

```css
:root,
[data-theme="light"] {
  --color-bg:         #f5f6f8;
  --color-surface:    #ffffff;
  --color-surface-2:  #f9fafb;
  --color-border:     #e5e7eb;

  --color-primary:    #1a3a5c;
  --color-accent:     #2d7ff9;
  --color-accent-bg:  #e8f0fe;

  --color-text:       #1f2937;
  --color-text-2:     #6b7280;
  --color-text-3:     #9ca3af;
  --color-text-on-primary: #ffffff;

  --color-success:    #10b981;
  --color-warning:    #f59e0b;
  --color-error:      #ef4444;

  --shadow-card:      0 1px 3px rgba(0,0,0,0.06);
}

[data-theme="dark"] {
  --color-bg:         #0a1628;
  --color-surface:    #0f1d35;
  --color-surface-2:  #152545;
  --color-border:     rgba(255,255,255,0.06);

  --color-primary:    #1a3a5c;
  --color-accent:     #2d7ff9;
  --color-accent-bg:  rgba(45,127,249,0.08);

  --color-text:       #e2e8f0;
  --color-text-2:     #64748b;
  --color-text-3:     #475569;
  --color-text-on-primary: #f1f5f9;

  --color-success:    #10b981;
  --color-warning:    #f59e0b;
  --color-error:      #ef4444;

  --shadow-card:      0 1px 3px rgba(0,0,0,0.2);
}
```

这样切换只需要一行 JS：
```js
document.documentElement.dataset.theme = 'dark'
```

## 排版

- 正文字体: system-ui / -apple-system / PingFang SC（原生系统字体，无需外部加载）
- 字号基准: 16px（阅读舒适）
- 层级:

```
Title  24px/28px Bold       → 页面标题
Head   18px/24px Semibold   → 卡片标题
Body   15px/22px Regular    → 正文
Caption 13px/18px Regular   → 辅助文字
Label  12px/16px Medium     → 标签/徽标
```

## 间距系统

4px 基准网格:
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80

卡片内边距: 16px
页面边距: 16px
卡片间距: 12px

## 圆角

微圆角: 6px  → 按钮/输入框
圆角:   12px → 卡片/弹窗
大圆角: 16px → 页面级容器
全圆:  50%   → 头像

## 组件规范

### 导航栏 (NavBar)
- 高度: 48px
- 左: 返回按钮
- 中: 页面标题 (18px Semibold)
- 右: 可选操作
- 底部分割线

### 标签栏 (TabBar)
- 高度: 56px (含安全区域)
- 5 个固定 tab: 首页、通知、作业、请假、我的
- 选中态: 主色高亮 icon + 文字
- 未选中: 灰色

### 卡片
- 白色背景
- 12px 圆角
- 16px 内边距
- 浅色阴影: 0 1px 3px rgba(0,0,0,0.08)
- 卡片间距: 12px

### 按钮
- 高度: 44px（触摸友好）
- 圆角: 6px
- 主按钮: 主色深蓝填充
- 次按钮: 白色 + 边框
- 文字按钮: 无边框

### 输入框
- 高度: 44px
- 圆角: 6px
- 边框: 1px solid #e5e7eb
- 聚焦: 主色边框 + 浅蓝阴影
