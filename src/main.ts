import { createApp as createVueApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import showCaptcha from "./components/show-captcha.vue";
import CustomNavBar from "./components/custom-nav-bar.vue";
import UniPopup from "@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue";
import UniLoadMore from "@dcloudio/uni-ui/lib/uni-load-more/uni-load-more.vue";
import UniTransition from "@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue";

export function createApp() {
  const app = createVueApp(App);

  app.use(createPinia());

  app.component("show-captcha", showCaptcha);
  app.component("custom-nav-bar", CustomNavBar);
  app.component("uni-popup", UniPopup);
  app.component("uni-load-more", UniLoadMore);
  app.component("uni-transition", UniTransition);

  return { app };
}

// H5 standalone mount: 注册 @dcloudio/uni-h5 插件使 uni.* API 和内置组件可用
if (typeof document !== "undefined") {
  import("@dcloudio/uni-h5").then(({ plugin: uniPlugin }) => {
    const mountApp = () => {
      const root = document.getElementById("app");
      if (root) {
        const { app } = createApp();
        app.use(uniPlugin);
        app.mount("#app");
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountApp);
    } else {
      mountApp();
    }
  });
}
