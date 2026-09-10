<script setup lang="ts">
import { mediaUrl, openMedia } from '@/utils/media'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createExpense } from '@/api/fee'
import { uploadFile } from '@/utils/request'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const router = useRouter()
const amount = ref(0)
const purpose = ref('')
const proofUrl = ref('')
const loading = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')

function triggerUpload() { fileInput.value?.click() }
async function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) { showToast('文件不超过10MB', 'error'); target.value = ''; return }
  uploading.value = true
  try {
    const res = await uploadFile('/api/fee/proof/upload', file)
    if (res.success && res.url) {
      proofUrl.value = res.url
      previewUrl.value = res.url
      showToast('上传成功')
    }
  } catch (e: any) { showToast(e?.message || '上传失败', 'error') }
  finally { uploading.value = false; target.value = '' }
}

async function handleSubmit() {
  if (!amount.value || amount.value <= 0) {
    showToast('请输入金额', 'error')
    return
  }
  if (!purpose.value.trim()) {
    showToast('请输入用途说明', 'error')
    return
  }
  loading.value = true
  try {
    const res = await createExpense({
      amount: Number(amount.value.toFixed(2)),
      purpose: purpose.value.trim(),
      proof_url: proofUrl.value || undefined
    })
    if (res.success) {
      showToast('申请已提交')
      router.replace('/pages/fee/index')
    } else {
      showToast(res.message || '提交失败', 'error')
    }
  } catch (_) {
    showToast('提交失败，请稍后重试', 'error')
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <div class="apply-page">
    <NavBar title="申请报销" show-back />
    <div class="form">
      <div class="form-group">
        <label>报销金额（元）</label>
        <input v-model.number="amount" type="number" step="0.01" min="0" placeholder="输入金额" class="input" />
      </div>
      <div class="form-group">
        <label>用途说明</label>
        <textarea v-model="purpose" placeholder="请详细说明报销用途" rows="4" class="textarea" maxlength="500" />
      </div>
      <div class="form-group">
        <label>凭证上传（选填）</label>
        <div v-if="previewUrl" class="preview-wrap">
          <img :src="mediaUrl(previewUrl)" class="preview-img" />
          <button class="preview-clear" @click="previewUrl = ''; proofUrl = ''">✕</button>
        </div>
        <button class="upload-btn" :disabled="uploading" @click="triggerUpload">
          {{ uploading ? '上传中...' : previewUrl ? '重新上传' : '+ 上传凭证图片' }}
        </button>
        <input ref="fileInput" type="file" accept="image/*" class="file-hidden" @change="handleFileChange" />
      </div>
      <button class="submit-btn" :disabled="loading" @click="handleSubmit">
        {{ loading ? '提交中...' : '提交申请' }}
      </button>
    </div>
  </div>
</template>
<style scoped>
.apply-page { padding-bottom: 80px; }
.form { padding: 20px 16px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.input, .textarea {
  width: 100%; padding: 12px 14px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: 15px; outline: none;
  background: var(--color-surface); color: var(--color-text); box-sizing: border-box;
}
.input:focus, .textarea:focus { border-color: var(--color-accent); }
.textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
.submit-btn {
  width: 100%; height: 48px; border: none; border-radius: var(--radius-md);
  background: var(--color-accent); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer;
}
.submit-btn:disabled { opacity: 0.5; }
.preview-wrap { position: relative; margin-bottom: 8px; }
.preview-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: var(--radius-sm); border: 1px solid var(--color-border); }
.preview-clear { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(0,0,0,0.5); color: #fff; font-size: 14px; cursor: pointer; }
.upload-btn { width: 100%; padding: 10px; border: 1px dashed var(--color-border); border-radius: var(--radius-sm); background: transparent; color: var(--color-accent); font-size: 13px; cursor: pointer; }
.upload-btn:disabled { opacity: 0.5; }
.file-hidden { display: none; }
</style>
