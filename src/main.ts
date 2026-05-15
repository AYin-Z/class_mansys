import { createApp as createVueApp } from "vue";
import { createPinia } from "pinia";
import { plugin as uniPlugin, uni } from "@dcloudio/uni-h5";
import App from "./App.vue";

// uni-app H5 模式下 uni 不会自动注册为全局变量，
// 但项目代码（request.ts、组件等）直接使用 uni.* 作为全局 API，
// 需要显式挂载到 window
(window as any).uni = uni;
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

app.mount("#app");
