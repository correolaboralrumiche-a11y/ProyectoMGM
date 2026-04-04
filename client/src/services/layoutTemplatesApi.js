import { api } from './api.js';

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const layoutTemplatesApi = {
  list(projectId) {
    return api.get(`/layout-templates${buildQuery({ projectId })}`);
  },
  detail(id) {
    return api.get(`/layout-templates/${id}`);
  },
  create(payload) {
    return api.post('/layout-templates', payload);
  },
  update(id, payload) {
    return api.patch(`/layout-templates/${id}`, payload);
  },
  remove(id) {
    return api.delete(`/layout-templates/${id}`);
  },
  catalog() {
    return api.get('/layout-templates/meta/catalog');
  },
  previewContext(id) {
    return api.get(`/layout-templates/${id}/preview-context`);
  },
  viewerData(id) {
    return api.get(`/layout-templates/${id}/viewer-data`);
  },
};
