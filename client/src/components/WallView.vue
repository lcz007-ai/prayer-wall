<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Bookmark, BookmarkCheck, Heart, HeartHandshake, LogOut, MapPin, MessageCircle, Plus, Search, Trash2 } from 'lucide-vue-next';
import { api } from '../api';
import { cityLabel } from '../regions';
import { ALL_TAGS } from '../tags';
import PostModal from './PostModal.vue';
import RegionPicker from './RegionPicker.vue';
import CommentsModal from './CommentsModal.vue';

const props = defineProps({
  user: { type: Object, required: true }
});
const emit = defineEmits(['logout', 'user-updated']);

const isGuest = computed(() => props.user.role === 'guest');
const scope = ref('same-city');
const activeTag = ref('');
const posts = ref([]);
const nextCursor = ref(null);
const loadingMore = ref(false);
const loading = ref(false);
const error = ref('');
const showPost = ref(false);
const showRegion = ref(false);
const needsRegion = ref(false);
const query = ref('');
const searchInput = ref('');
const commentPost = ref(null);
let searchTimer;

async function loadPosts() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.posts(scope.value, activeTag.value, query.value);
    posts.value = data.posts;
    nextCursor.value = data.nextCursor;
    needsRegion.value = data.needsRegion;
    if (data.needsRegion) showRegion.value = true;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return;
  loadingMore.value = true;
  error.value = '';
  try {
    const data = await api.posts(scope.value, activeTag.value, query.value, nextCursor.value);
    posts.value.push(...data.posts);
    nextCursor.value = data.nextCursor;
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingMore.value = false;
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

function changeSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query.value = searchInput.value.trim();
    loadPosts();
  }, 250);
}

onUnmounted(() => clearTimeout(searchTimer));

function openPost() {
  if (isGuest.value) return;
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

async function setAnswered(post) {
  const next = post.status === 'answered' ? 'open' : 'answered';
  try {
    const data = await api.setAnswered(post.id, next);
    post.status = data.status;
  } catch (err) {
    error.value = err.message;
  }
}

async function toggleSave(post) {
  try {
    const method = post.saved ? api.unsavePost : api.savePost;
    const data = await method(post.id);
    post.saved = data.saved;
  } catch (err) {
    error.value = err.message;
  }
}

function openComments(post) {
  commentPost.value = post;
}

function handleCommentCount(count) {
  if (commentPost.value) commentPost.value.commentCount = count;
}

function canDelete(post) {
  return !isGuest.value && (post.mine || props.user.role === 'admin');
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
          <h1>守望贴纸墙</h1>
          <button class="scope-link" type="button" @click="showRegion = true">
            <MapPin :size="14" />
            <span>{{ scope === 'same-city' ? (cityLabel(user.province, user.city) || '选择地区') : '全国' }}</span>
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
        <button :class="{ active: scope === 'saved' }" type="button" @click="changeScope('saved')">收藏</button>
        <button :class="{ active: scope === 'mine' }" type="button" @click="changeScope('mine')">我的</button>
      </div>
    </nav>

    <p v-if="isGuest" class="banner guest-banner">当前为访客模式，仅可浏览守望贴纸墙。</p>

    <div class="search-bar">
      <Search :size="17" />
      <input
        v-model="searchInput"
        type="search"
        maxlength="50"
        aria-label="搜索代祷内容或昵称"
        placeholder="搜索代祷内容或昵称"
        @input="changeSearch"
      />
    </div>

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
        <article
          v-for="post in posts"
          :key="post.id"
          class="sticker"
          :class="[`sticker-${post.id % 6}`, { 'sticker-answered': post.status === 'answered' }]"
        >
          <span v-if="post.status === 'answered'" class="answered-badge">
            <Check :size="13" /> 已蒙应允
          </span>
          <p class="sticker-content">{{ post.content }}</p>
          <div v-if="post.tags && post.tags.length" class="post-tags">
            <span v-for="tag in post.tags" :key="tag" class="mini-tag">{{ tag }}</span>
          </div>
          <div class="sticker-meta">
            <span class="nickname">{{ post.nickname }}</span>
            <span class="region">{{ [cityLabel(post.province, post.city), post.district].filter(Boolean).join(' · ') }}</span>
          </div>
          <footer class="sticker-foot">
            <span class="time">{{ timeText(post.createdAt) }}</span>
            <div class="sticker-actions">
              <button
                v-if="!isGuest"
                class="action-btn"
                :class="{ saved: post.saved }"
                type="button"
                :title="post.saved ? '取消收藏' : '收藏'"
                :aria-label="post.saved ? '取消收藏' : '收藏'"
                @click="toggleSave(post)"
              >
                <BookmarkCheck v-if="post.saved" :size="16" />
                <Bookmark v-else :size="16" />
              </button>
              <button
                class="action-btn"
                :class="{ replied: post.commentCount > 0 }"
                type="button"
                title="回应留言"
                aria-label="回应留言"
                @click="openComments(post)"
              >
                <MessageCircle :size="16" />
                <span>{{ post.commentCount }}</span>
              </button>
              <button
                class="pray-btn"
                :class="{ prayed: post.prayed }"
                type="button"
                :disabled="post.prayed || post.mine"
                :title="isGuest ? '访客仅可浏览' : post.mine ? '自己的需求' : '我已祷告'"
                @click="pray(post)"
              >
                <Heart :size="16" :fill="post.prayed ? 'currentColor' : 'none'" />
                <span>{{ post.prayCount }}</span>
              </button>
              <button
                v-if="canDelete(post)"
                class="action-btn"
                :class="{ answered: post.status === 'answered' }"
                type="button"
                :title="post.status === 'answered' ? '取消应允标记' : '标记为已蒙应允'"
                :aria-label="post.status === 'answered' ? '取消应允标记' : '标记为已蒙应允'"
                @click="setAnswered(post)"
              >
                <Check :size="16" />
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
      <div v-if="nextCursor && !loading" class="load-more">
        <button class="load-more-btn" type="button" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
      <div v-else-if="!loading && !posts.length" class="empty-state">
        <HeartHandshake class="empty-icon" :size="42" :stroke-width="1.5" />
        <p>{{ scope === 'same-city' ? '附近还没有代祷需求' : '还没有代祷需求' }}</p>
        <button v-if="!isGuest" class="primary-btn" type="button" @click="openPost">写下第一条</button>
      </div>
    </main>

    <button
      v-if="!isGuest"
      class="fab"
      type="button"
      title="写下代祷需求"
      aria-label="写下代祷需求"
      @click="openPost"
    >
      <Plus :size="26" />
    </button>

    <PostModal v-if="showPost" :user="user" @close="showPost = false" @created="handleCreated" />
    <CommentsModal
      v-if="commentPost"
      :post="commentPost"
      :read-only="isGuest"
      @close="commentPost = null"
      @changed="handleCommentCount"
    />
    <RegionPicker
      v-if="showRegion"
      :region="user"
      :required="needsRegion"
      @close="showRegion = false"
      @save="handleRegionSaved"
    />
  </div>
</template>



