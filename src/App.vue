<template>
  <router-view />
</template>

<script setup lang="ts">
// Hooks resolved via src/shims/uni-lifecycle.ts (vite alias)
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { initCloudBase, checkEnvironment } from "./utils/cloudbase";
import { useUserStore } from "@/stores/user";
import { routeGuard } from "@/composables/useRouteGuard";
import { setRouteGuard } from "@/utils/request";
// #ifdef APP-PLUS
import { checkAppUpdate } from "@/utils/update-checker";
// #endif
import router from "@/router";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

const TAB_PATHS = [
  '/pages/index/index',
  '/pages/notice/index',
  '/pages/homework/index',
  '/pages/leave/index',
  '/pages/profile/index',
  '/pages/dashboard/index',
]

// 浏览器环境：tab 首页侧滑时阻止关闭标签页
// 因为 tab 切换使用 reLaunch（router.replace）不产生历史记录
if (!Capacitor.isNativePlatform()) {
  window.addEventListener('popstate', () => {
    const path = router.currentRoute.value.path
    if (TAB_PATHS.includes(path)) {
      // 重新推入当前 hash，防止浏览器关闭 tab
      history.pushState(null, '', window.location.href)
    }
  })
}

onLaunch(async () => {
  try {
  console.log("App Launch");

  // 并行初始化：cloudbase 不阻塞 hydrate / routeGuard
  const cloudPromise = checkEnvironment()
    ? initCloudBase().then(success => {
        if (success) console.log("云开发初始化成功");
        else console.warn("云开发初始化失败");
      }).catch(error => {
        console.error("云开发初始化异常:", error);
      })
    : Promise.resolve();

  // 从本地恢复用户信息
  const userStore = useUserStore();
  userStore.hydrate();

  // 注册 401 拦截回调
  setRouteGuard(() => routeGuard(undefined, true));

  // 路由守卫（首次校验）
  routeGuard();

  // #ifdef APP-PLUS
  // cloudbase 初始化完成后再检查更新
  cloudPromise.then(() => {
    setTimeout(() => {
      checkAppUpdate({ silent: true }).catch(err => {
        console.warn("[update] 启动时检查更新失败", err);
      });
    }, 3000);
  });
  // #endif

  // 安卓物理返回 / 全面屏侧滑 — 双击退出，防误触
  if (Capacitor.isNativePlatform()) {
    let exitBackCount = 0
    CapacitorApp.addListener('backButton', () => {
      const path = router.currentRoute.value.path
      if (TAB_PATHS.includes(path)) {
        // tab 首页：双击退出（2 秒内按两次才退）
        if (exitBackCount === 0) {
          exitBackCount = 1
          setTimeout(() => { exitBackCount = 0 }, 2000)
        } else {
          CapacitorApp.minimizeApp()
        }
      } else {
        // 子页面：正常历史回退
        router.back()
      }
    })
  }
} catch (_) { /* may throw in H5 dev */ }
});

onShow(() => {
  console.log("App Show");
  // 每次应用切回前台时重新校验登录状态
  routeGuard();
});

onHide(() => {
  console.log("App Hide");
});
</script>

<style lang="scss">
@import "@/uni.scss";

/* ========== 全局 reset ========== */
page {
  background-color: $surface;
  font-family: $font-body;
  color: $on-surface;
}

div, span, button, input, textarea {
  box-sizing: border-box;
}

/* ========== 通用按钮（仅供旧页面降级使用，新页面请使用 .primary-btn / mixin） ========== */
.btn {
  border-radius: $radius-md;
  font-size: $body-lg;
  padding: 20rpx 40rpx;
  border: none;
  transition: opacity $transition-fast;
}

.btn-primary {
  background: $gradient-primary;
  color: $on-primary;

  &:active { opacity: 0.92; }
}

.btn-secondary {
  background-color: $surface-container-low;
  color: $on-surface;

  &:active { background-color: $surface-container; }
}

.btn:disabled { opacity: $uni-opacity-disabled; }

/* ========== 通用卡片 ========== */
.card {
  background: $surface-container-lowest;
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin: $spacing-sm;
  box-shadow: $shadow-ambient;
}

/* ========== 通用输入框 ========== */
.input {
  padding: 20rpx;
  border-radius: $radius-md;
  font-size: $body-lg;
  background-color: $surface-container-lowest;
  /* 「No-Line」: 不再使用 1px solid border，仅在 focus 时显示 */
  border: 2rpx solid transparent;

  &:focus {
    border-color: $primary;
  }
}
</style>
