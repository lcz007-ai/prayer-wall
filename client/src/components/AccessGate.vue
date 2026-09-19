<script setup>
import { ref } from 'vue';
import { api, setAccessToken } from '../api';

const emit = defineEmits(['success']);
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const data = await api.access(password.value);
    setAccessToken(data.token);
    emit('success');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <div class="brand-badge">祷</div>
      <h1>守望贴纸墙</h1>
      <p class="auth-sub">请输入访问口令</p>
      <form @submit.prevent="submit">
        <input v-model="password" type="password" autocomplete="current-password" placeholder="访问口令" />
        <button class="primary-btn" type="submit" :disabled="loading || !password">进入</button>
      </form>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>
  </main>
</template>
