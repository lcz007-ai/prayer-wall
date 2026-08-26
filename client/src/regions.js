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

export function regionLabel(region) {
  if (!region) return '';
  return [region.province, region.city, region.district].filter(Boolean).join(' · ');
}
