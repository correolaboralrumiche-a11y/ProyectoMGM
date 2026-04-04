import { api } from './api.js';

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export const layoutTemplatesApi = {
  list(projectId) {
    return api.get(withQuery('/layout-templates', { projectId }));
  },

  detail(id) {
    return api.get(`/layout-templates/${id}`);
  },

  create(payload) {
    return api.post('/layout-templates', payload);
  },

  update(id, payload) {
    return api.put(`/layout-templates/${id}`, payload);
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

export default layoutTemplatesApi;
