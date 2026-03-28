import { api } from './api.js';

export const catalogsApi = {
  listAll() {
    return api.get('/catalogs');
  },

  get(catalogKey, params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || String(value).trim() === '') continue;
      search.set(key, String(value));
    }

    const query = search.toString();
    return api.get(`/catalogs/${catalogKey}${query ? `?${query}` : ''}`);
  },

  create(catalogKey, payload) {
    return api.post(`/catalogs/${catalogKey}`, payload);
  },

  update(catalogKey, code, payload) {
    return api.put(`/catalogs/${catalogKey}/${code}`, payload);
  },
};
