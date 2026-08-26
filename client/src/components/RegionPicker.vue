<script setup>
import { computed, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { getCities, getDistricts, getProvinces } from '../regions';

const props = defineProps({
  region: { type: Object, default: () => ({}) },
  required: { type: Boolean, default: false }
});
const emit = defineEmits(['close', 'save']);

const provinces = getProvinces();
const province = ref(props.region.province || '');
const city = ref(props.region.city || '');
const district = ref(props.region.district || '');
const cities = computed(() => getCities(province.value));
const districts = computed(() => getDistricts(province.value, city.value));

watch(province, () => {
  city.value = '';
  district.value = '';
});
watch(city, () => {
  district.value = '';
});

function save() {
  if (!province.value || !city.value) return;
  emit('save', { province: province.value, city: city.value, district: district.value });
}
</script>

<template>
  <div class="modal-overlay" @click.self="!required && emit('close')">
    <section class="sheet">
      <header class="sheet-head">
        <h2>选择所在地区</h2>
        <button v-if="!required" class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>
      <p class="region-tip">同城代祷需求会默认展示给你</p>
      <div class="region-grid">
        <label>
          <span>省</span>
          <select v-model="province">
            <option value="" disabled>请选择</option>
            <option v-for="p in provinces" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
        <label>
          <span>市</span>
          <select v-model="city" :disabled="!province">
            <option value="" disabled>请选择</option>
            <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label>
          <span>区</span>
          <select v-model="district" :disabled="!city">
            <option value="" disabled>请选择</option>
            <option v-for="d in districts" :key="d" :value="d">{{ d }}</option>
          </select>
        </label>
      </div>
      <button class="primary-btn" type="button" :disabled="!province || !city" @click="save">保存</button>
    </section>
  </div>
</template>
