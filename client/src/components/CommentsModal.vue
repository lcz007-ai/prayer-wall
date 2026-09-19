<script setup>
import { onMounted, ref } from 'vue';
import { Send, Trash2, X } from 'lucide-vue-next';
import { api } from '../api';
import { cityLabel } from '../regions';

const props = defineProps({
  post: { type: Object, required: true },
  readOnly: { type: Boolean, default: false }
});
const emit = defineEmits(['close', 'changed']);

const comments = ref([]);
const content = ref('');
const loading = ref(true);
const submitting = ref(false);
const error = ref('');

async function loadComments() {
  error.value = '';
  try {
    const data = await api.comments(props.post.id);
    comments.value = data.comments;
    emit('changed', data.comments.length);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const text = content.value.trim();
  if (!text || submitting.value) return;
  error.value = '';
  submitting.value = true;
  try {
    await api.addComment(props.post.id, text);
    content.value = '';
    await loadComments();
  } catch (err) {
    error.value = err.message;
  } finally {
    submitting.value = false;
  }
}

async function remove(comment) {
  if (!window.confirm('确定删除这条回应吗？')) return;
  error.value = '';
  try {
    await api.deleteComment(props.post.id, comment.id);
    await loadComments();
  } catch (err) {
    error.value = err.message;
  }
}

function timeText(value) {
  const date = new Date(value.replace(' ', 'T') + 'Z');
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return value.slice(0, 10);
}

onMounted(loadComments);
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <section class="sheet comments-sheet" aria-labelledby="comments-title">
      <header class="sheet-head">
        <h2 id="comments-title">回应留言</h2>
        <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <div class="comment-post">
        <p>{{ post.content }}</p>
        <span>{{ post.nickname }} · {{ cityLabel(post.province, post.city) || '全国' }}</span>
      </div>

      <div class="comment-list" aria-live="polite">
        <p v-if="loading" class="banner">正在加载回应...</p>
        <p v-else-if="!comments.length" class="banner">
          {{ readOnly ? '还没有回应留言。' : '还没有回应，留下一句扶持的话吧。' }}
        </p>
        <article v-for="comment in comments" :key="comment.id" class="comment-item">
          <div class="comment-head">
            <strong>{{ comment.nickname }}</strong>
            <span>{{ timeText(comment.createdAt) }}</span>
          </div>
          <p>{{ comment.content }}</p>
          <button
            v-if="comment.canDelete"
            class="icon-btn small comment-delete"
            type="button"
            title="删除回应"
            aria-label="删除回应"
            @click="remove(comment)"
          >
            <Trash2 :size="15" />
          </button>
        </article>
      </div>

      <form v-if="!readOnly" class="comment-form" @submit.prevent="submit">
        <div class="field">
          <textarea v-model="content" maxlength="200" rows="3" placeholder="用祷告、鼓励或经文回应对方" required></textarea>
          <span class="char-count">{{ content.length }}/200</span>
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="primary-btn" type="submit" :disabled="submitting || !content.trim()">
          <Send :size="17" />
          <span>{{ submitting ? '送出中...' : '送出回应' }}</span>
        </button>
      </form>
    </section>
  </div>
</template>


