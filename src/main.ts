import { createApp as createVueApp } from "vue";
import { createPinia } from "pinia";
import { plugin as uniPlugin } from "@dcloudio/uni-h5";
import App from "./App.vue";
import showCaptcha from "./components/show-captcha.vue";
import CustomNavBar from "./components/custom-nav-bar.vue";
import UniPopup from "@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue";
import UniLoadMore from "@dcloudio/uni-ui/lib/uni-load-more/uni-load-more.vue";
import UniTransition from "@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue";

const app = createVueApp(App);

app.use(createPinia());
app.use(uniPlugin);

app.component("show-captcha", showCaptcha);
app.component("custom-nav-bar", CustomNavBar);
app.component("uni-popup", UniPopup);
app.component("uni-load-more", UniLoadMore);
app.component("uni-transition", UniTransition);

// #ifndef H5
export function createApp() {
  return { app };
}
// #endif

// #ifdef H5
app.mount("#app");
// #endif
