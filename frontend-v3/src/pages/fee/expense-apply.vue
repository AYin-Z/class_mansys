<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createExpense } from '@/api/fee'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const router = useRouter()
const amount = ref(0)
const purpose = ref('')
const proofUrl = ref('')
const loading = ref(false)

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
        <label>凭证链接（选填）</label>
        <input v-model="proofUrl" placeholder="图片或发票链接" class="input" />
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
</style>
