<template>
  <view class="webview-page">
    <custom-nav-bar title="外部系统" :showBack="true" />
    <web-view :src="url"></web-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
const url = ref('about:blank')

onLoad((options) => {
  if (options && options.url) {
    url.value = decodeURIComponent(options.url)
  }
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.webview-page { min-height: 100vh; background-color: #f7f9fc; }
</style>
