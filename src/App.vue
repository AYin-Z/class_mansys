<template>
  <router-view />
</template>

<script setup lang="ts">


import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { initCloudBase, checkEnvironment } from "./utils/cloudbase";
import { useUserStore } from "@/stores/user";
import { setRouteGuard } from "@/utils/request";
import { checkAppUpdate } from "@/utils/update-checker";
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
      history.pushState(null, '', window.location.href)
    }
  })
}

onMounted(async () => {
  try {
    console.log("App Launch");

    const cloudPromise = checkEnvironment()
      ? initCloudBase().then(() => console.log("云开发初始化成功"))
          .catch(e => console.error("云开发初始化异常:", e))
      : Promise.resolve();

    const userStore = useUserStore();
    userStore.hydrate();
    setRouteGuard(() => {
      const loginPath = '/pages/login/password-login'
      if (router.currentRoute.value.path !== loginPath) {
        router.replace(loginPath)
      }
    });
    // router.beforeEach 已处理首次导航守卫，此处只初始化 store

    cloudPromise.then(() => {
      setTimeout(() => {
        checkAppUpdate({ silent: true }).catch(err => {
          console.warn("[update] 启动时检查更新失败", err);
        });
      }, 3000);
    });

    // 安卓物理返回 / 全面屏侧滑 — 双击退出，防误触
    if (Capacitor.isNativePlatform()) {
      let exitBackCount = 0
      CapacitorApp.addListener('backButton', () => {
        const path = router.currentRoute.value.path
        if (TAB_PATHS.includes(path)) {
          if (exitBackCount === 0) {
            exitBackCount = 1
            setTimeout(() => { exitBackCount = 0 }, 2000)
          } else {
            CapacitorApp.minimizeApp()
          }
        } else {
          router.back()
        }
      })
    }
  } catch (_) { /* may throw in H5 dev */ }
});

onMounted(() => {
  console.log("App Show");
});

onActivated(() => {
  console.log("App Show (activated)");
});

onUnmounted(() => {
  console.log("App Hide");
});

onDeactivated(() => {
  console.log("App Hide (deactivated)");
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

.card {
  background: $surface-container-lowest;
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin: $spacing-sm;
  box-shadow: $shadow-ambient;
}

.input {
  padding: 20rpx;
  border-radius: $radius-md;
  font-size: $body-lg;
  background-color: $surface-container-lowest;
  border: 2rpx solid transparent;
  &:focus { border-color: $primary; }
}
</style>
