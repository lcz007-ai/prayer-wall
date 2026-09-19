import data from './assets/regions.json';

export function getProvinces() {
  return Object.keys(data);
}

export function getCities(provinceName) {
  const cities = data[provinceName];
  return cities ? Object.keys(cities) : [];
}

export function getDistricts(provinceName, cityName) {
  const districts = data[provinceName]?.[cityName];
  return districts || [];
}

export function cityLabel(provinceName, cityName) {
  if (!cityName) return '';
  return cityName === '市辖区' ? provinceName || '' : cityName;
}

export function regionLabel(region) {
  if (!region) return '';
  return [region.province, cityLabel(region.province, region.city), region.district].filter(Boolean).join(' · ');
}

