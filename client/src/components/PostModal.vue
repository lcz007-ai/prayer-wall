<script setup>
import { computed, ref, watch } from 'vue';
import { MapPin, X } from 'lucide-vue-next';
import { api } from '../api';
import { regionLabel } from '../regions';
import { ALL_TAGS, recommendTags } from '../tags';

const props = defineProps({
  user: { type: Object, required: true }
});
const emit = defineEmits(['close', 'created']);

const content = ref('');
const nickname = ref(props.user?.nickname || '');
const error = ref('');
const submitting = ref(false);
const selectedTags = ref([]);
const regionText = computed(() => regionLabel(props.user));
const recommendedTags = computed(() => recommendTags(content.value));

watch(recommendedTags, (next) => {
  selectedTags.value = next;
});

function toggleTag(tag) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter((t) => t !== tag);
  } else if (selectedTags.value.length < 3) {
    selectedTags.value.push(tag);
  }
}

async function submit() {
  error.value = '';
  submitting.value = true;
  try {
    await api.createPost({ content: content.value, nickname: nickname.value, tags: selectedTags.value });
    emit('created');
  } catch (err) {
    error.value = err.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <section class="sheet">
      <header class="sheet-head">
        <h2>写下代祷需求</h2>
        <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>
      <form @submit.prevent="submit">
        <div class="field">
          <textarea v-model="content" maxlength="500" rows="4" placeholder="想让大家为你祷告什么？" required></textarea>
          <span class="char-count">{{ content.length }}/500</span>
        </div>
        <div class="field">
          <input v-model="nickname" maxlength="20" placeholder="昵称（留空显示匿名）" />
        </div>
        <div class="tag-section">
          <p class="tag-title">标签（自动推荐，可调整）</p>
          <div class="tag-row">
            <button
              v-for="tag in ALL_TAGS"
              :key="tag"
              class="tag-chip"
              :class="{ active: selectedTags.includes(tag), recommended: recommendedTags.includes(tag) && !selectedTags.includes(tag) }"
              type="button"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>
        <div class="region-note">
          <MapPin :size="16" />
          <span>{{ regionText }}</span>
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="primary-btn" type="submit" :disabled="submitting || !content.trim()">
          {{ submitting ? '发布中...' : '发布' }}
        </button>
      </form>
    </section>
  </div>
</template>
