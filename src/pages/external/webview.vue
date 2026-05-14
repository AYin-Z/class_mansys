<template>
  <view class="webview-page">
    <custom-nav-bar title="外部系统" :showBack="true" />
    <web-view :src="url"></web-view>
  </view>
</template>

<script setup>
import { ref, onLoad } from 'vue'
const url = ref('about:blank')

onLoad((options) => {
  if (options && options.url) {
    url.value = decodeURIComponent(options.url)
  }
})
</script>

<style lang="scss" scoped
> .webview-page { min-height: 100vh; background-color: #f7f9fc; }
</style>