import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
<template>
  <div class="webview-page">
    <custom-nav-bar title="外部系统" :showBack="true" />
    <web-view :src="url"></web-view>
  </div>
</template>

<script setup lang="ts">

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
