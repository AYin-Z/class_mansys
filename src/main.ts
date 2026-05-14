import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import showCaptcha from "./components/show-captcha.vue";
import CustomNavBar from "./components/custom-nav-bar.vue";
import UniPopup from "@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue";
import UniLoadMore from "@dcloudio/uni-ui/lib/uni-load-more/uni-load-more.vue";
import UniTransition from "@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue";

export function createApp() {
  const app = createSSRApp(App);

  app.use(createPinia());

  app.component("show-captcha", showCaptcha);
  app.component("custom-nav-bar", CustomNavBar);
  app.component("uni-popup", UniPopup);
  app.component("uni-load-more", UniLoadMore);
  app.component("uni-transition", UniTransition);

  return {
    app,
  };
}

// H5 standalone mount
if (typeof document !== 'undefined') {
  const mountApp = () => {
    const root = document.getElementById('app');
    if (root) {
      createApp().app.mount('#app');
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
  } else {
    mountApp();
  }
}
