<script setup>
import { onMounted, ref } from 'vue';
import { api, clearAccessToken } from './api';
import AccessGate from './components/AccessGate.vue';
import LoginView from './components/LoginView.vue';
import WallView from './components/WallView.vue';

const state = ref('loading');
const user = ref(null);

async function loadMe() {
  state.value = 'loading';
  try {
    const data = await api.me();
    user.value = data.user;
    state.value = 'wall';
  } catch (err) {
    state.value = err.status === 403 ? 'access' : 'login';
  }
}

function handleAccess() {
  loadMe();
}

function handleLogin(nextUser) {
  user.value = nextUser;
  state.value = 'wall';
}

function handleLogout() {
  clearAccessToken();
  user.value = null;
  state.value = 'login';
}

function handleUserUpdated(nextUser) {
  user.value = nextUser;
}

onMounted(loadMe);
</script>

<template>
  <AccessGate v-if="state === 'access'" @success="handleAccess" />
  <LoginView v-else-if="state === 'login'" @logged-in="handleLogin" />
  <WallView v-else-if="state === 'wall'" :user="user" @logout="handleLogout" @user-updated="handleUserUpdated" />
  <div v-else class="boot-screen">加载中...</div>
</template>
