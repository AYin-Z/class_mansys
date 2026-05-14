<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { initCloudBase, checkEnvironment } from "./utils/cloudbase";
import { useUserStore } from "@/stores/user";
// #ifdef APP-PLUS
import { checkAppUpdate } from "@/utils/update-checker";
// #endif

onLaunch(async () => {
  console.log("App Launch");

  if (checkEnvironment()) {
    try {
      const success = await initCloudBase();
      if (success) {
        console.log("云开发初始化成功");
      } else {
        console.warn("云开发初始化失败");
      }
    } catch (error) {
      console.error("云开发初始化异常:", error);
    }
  } else {
    console.warn("云开发环境ID未配置，请在 src/utils/cloudbase.ts 中配置");
  }

  // 从本地恢复用户信息（store 内已自动处理）
  const userStore = useUserStore();
  userStore.hydrate();

  routeGuard(userStore);

  // #ifdef APP-PLUS
  // App 启动后延迟 3s 静默检查更新，避免阻塞首屏
  setTimeout(() => {
    checkAppUpdate({ silent: true }).catch(err => {
      console.warn("[update] 启动时检查更新失败", err);
    });
  }, 3000);
  // #endif
});

onShow(() => {
  console.log("App Show");
});

onHide(() => {
  console.log("App Hide");
});

function routeGuard(userStore: ReturnType<typeof useUserStore>) {
  if (userStore.isAuthenticated) return;

  // 已经在注册/登录页就别再跳
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  const route = current?.route || current?.$page?.fullPath || "";
  if (route.includes("auth/register") || route.includes("auth/login") || route.includes("login/password") || route.includes("login/phone") || route.includes("login/email")) return;

  uni.reLaunch({ url: "/pages/auth/register" });
}
</script>

<style lang="scss">
@import "@/uni.scss";

/* ========== 全局 reset ========== */
page {
  background-color: $surface;
  font-family: $font-body;
  color: $on-surface;
}

view, text, button, input, textarea {
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
