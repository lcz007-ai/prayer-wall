<script setup>
import { onMounted, ref } from 'vue';
import { Heart, HeartHandshake, LogOut, MapPin, Plus, Trash2 } from 'lucide-vue-next';
import { api } from '../api';
import { ALL_TAGS } from '../tags';
import PostModal from './PostModal.vue';
import RegionPicker from './RegionPicker.vue';

const props = defineProps({
  user: { type: Object, required: true }
});
const emit = defineEmits(['logout', 'user-updated']);

const scope = ref('same-city');
const activeTag = ref('');
const posts = ref([]);
const loading = ref(false);
const error = ref('');
const showPost = ref(false);
const showRegion = ref(false);
const needsRegion = ref(false);

async function loadPosts() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.posts(scope.value, activeTag.value);
    posts.value = data.posts;
    needsRegion.value = data.needsRegion;
    if (data.needsRegion) showRegion.value = true;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function changeScope(next) {
  if (next === scope.value) return;
  scope.value = next;
  loadPosts();
}

function changeTag(tag) {
  if (tag === activeTag.value) return;
  activeTag.value = tag;
  loadPosts();
}

function openPost() {
  if (!props.user.city) {
    showRegion.value = true;
    return;
  }
  showPost.value = true;
}

function handleCreated() {
  showPost.value = false;
  loadPosts();
}

async function handleRegionSaved(region) {
  error.value = '';
  try {
    const data = await api.updateMe(region);
    showRegion.value = false;
    emit('user-updated', data.user);
    loadPosts();
  } catch (err) {
    error.value = err.message;
  }
}

async function pray(post) {
  if (post.prayed || post.mine) return;
  try {
    const data = await api.pray(post.id);
    post.prayCount = data.prayCount;
    post.prayed = true;
  } catch (err) {
    error.value = err.message;
  }
}

async function remove(post) {
  if (!window.confirm('确定删除这条代祷需求吗？')) return;
  try {
    await api.deletePost(post.id);
    posts.value = posts.value.filter((p) => p.id !== post.id);
  } catch (err) {
    error.value = err.message;
  }
}

function canDelete(post) {
  return post.mine || props.user.role === 'admin';
}

function timeText(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

onMounted(() => {
  if (!props.user.city) showRegion.value = true;
  loadPosts();
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-badge">祷</span>
        <div>
          <h1>守望代祷墙</h1>
          <button class="scope-link" type="button" @click="showRegion = true">
            <MapPin :size="14" />
            <span>{{ scope === 'same-city' ? (user.city || '选择地区') : '全国' }}</span>
          </button>
        </div>
      </div>
      <button class="icon-btn" type="button" title="退出登录" aria-label="退出登录" @click="emit('logout')">
        <LogOut :size="20" />
      </button>
    </header>

    <nav class="scope-bar" aria-label="查看范围">
      <div class="segmented">
        <button :class="{ active: scope === 'same-city' }" type="button" @click="changeScope('same-city')">附近</button>
        <button :class="{ active: scope === 'all' }" type="button" @click="changeScope('all')">全国</button>
      </div>
    </nav>

    <nav class="tag-bar" aria-label="按标签筛选">
      <button :class="{ active: activeTag === '' }" type="button" @click="changeTag('')">全部</button>
      <button
        v-for="tag in ALL_TAGS"
        :key="tag"
        :class="{ active: activeTag === tag }"
        type="button"
        @click="changeTag(tag)"
      >
        {{ tag }}
      </button>
    </nav>

    <main class="wall-wrap">
      <p v-if="error" class="banner error">{{ error }}</p>
      <p v-if="loading" class="banner">正在加载...</p>
      <div v-if="!loading && posts.length" class="wall">
        <article v-for="post in posts" :key="post.id" class="sticker" :class="`sticker-${post.id % 6}`">
          <p class="sticker-content">{{ post.content }}</p>
          <div v-if="post.tags && post.tags.length" class="post-tags">
            <span v-for="tag in post.tags" :key="tag" class="mini-tag">{{ tag }}</span>
          </div>
          <div class="sticker-meta">
            <span class="nickname">{{ post.nickname }}</span>
            <span class="region">{{ [post.city, post.district].filter(Boolean).join(' · ') }}</span>
          </div>
          <footer class="sticker-foot">
            <span class="time">{{ timeText(post.createdAt) }}</span>
            <div class="sticker-actions">
              <button
                class="pray-btn"
                :class="{ prayed: post.prayed }"
                type="button"
                :disabled="post.prayed || post.mine"
                :title="post.mine ? '自己的需求' : '我已祷告'"
                @click="pray(post)"
              >
                <Heart :size="16" :fill="post.prayed ? 'currentColor' : 'none'" />
                <span>{{ post.prayCount }}</span>
              </button>
              <button
                v-if="canDelete(post)"
                class="icon-btn small"
                type="button"
                title="删除"
                aria-label="删除"
                @click="remove(post)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </footer>
        </article>
      </div>
      <div v-else-if="!loading && !posts.length" class="empty-state">
        <HeartHandshake class="empty-icon" :size="42" :stroke-width="1.5" />
        <p>{{ scope === 'same-city' ? '附近还没有代祷需求' : '还没有代祷需求' }}</p>
        <button class="primary-btn" type="button" @click="openPost">写下第一条</button>
      </div>
    </main>

    <button class="fab" type="button" title="写下代祷需求" aria-label="写下代祷需求" @click="openPost">
      <Plus :size="26" />
    </button>

    <PostModal v-if="showPost" :user="user" @close="showPost = false" @created="handleCreated" />
    <RegionPicker
      v-if="showRegion"
      :region="user"
      :required="needsRegion"
      @close="showRegion = false"
      @save="handleRegionSaved"
    />
  </div>
</template>
