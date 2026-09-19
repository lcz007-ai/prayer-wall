<script setup>
import { computed, onUnmounted, ref } from 'vue';
import { UserRound } from 'lucide-vue-next';
import { api } from '../api';

const emit = defineEmits(['logged-in']);
const phone = ref('');
const code = ref('');
const countdown = ref(0);
const error = ref('');
const devCode = ref('');
const sending = ref(false);
const loggingIn = ref(false);
const guestLoading = ref(false);
let timer = null;

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value.trim()));
const canSend = computed(() => phoneValid.value && countdown.value === 0 && !sending.value);

async function sendCode() {
  error.value = '';
  devCode.value = '';
  sending.value = true;
  try {
    const data = await api.sendCode(phone.value.trim());
    if (data.devCode) devCode.value = data.devCode;
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } catch (err) {
    error.value = err.message;
  } finally {
    sending.value = false;
  }
}

async function login() {
  error.value = '';
  loggingIn.value = true;
  try {
    const data = await api.login(phone.value.trim(), code.value.trim());
    emit('logged-in', data.user);
  } catch (err) {
    error.value = err.message;
  } finally {
    loggingIn.value = false;
  }
}

async function guestLogin() {
  error.value = '';
  guestLoading.value = true;
  try {
    const data = await api.guestLogin();
    emit('logged-in', data.user);
  } catch (err) {
    error.value = err.message;
  } finally {
    guestLoading.value = false;
  }
}

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <div class="brand-badge">祷</div>
      <h1>守望代祷墙</h1>
      <p class="auth-sub">手机号登录后即可查看和发布代祷需求</p>
      <form @submit.prevent="login">
        <div class="phone-row">
          <input v-model="phone" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="手机号" />
          <button class="ghost-btn" type="button" :disabled="!canSend" @click="sendCode">
            {{ countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码' }}
          </button>
        </div>
        <input v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="验证码" />
        <button class="primary-btn" type="submit" :disabled="loggingIn || code.length !== 6">
          {{ loggingIn ? '登录中...' : '登录' }}
        </button>
      </form>
      <div class="auth-divider"><span>或</span></div>
      <button class="secondary-btn" type="button" :disabled="guestLoading" @click="guestLogin">
        <UserRound :size="18" />
        <span>{{ guestLoading ? '进入中...' : '访客登录' }}</span>
      </button>
      <p v-if="devCode" class="dev-hint">本地测试验证码：{{ devCode }}</p>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>
  </main>
</template>
