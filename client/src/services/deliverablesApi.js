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

export const deliverablesApi = {
  list(projectId, filters = {}) {
    return api.get(`/deliverables${buildQuery({ projectId, ...filters })}`);
  },
  detail(id) {
    return api.get(`/deliverables/${id}`);
  },
  create(payload) {
    return api.post('/deliverables', payload);
  },
  update(id, payload) {
    return api.put(`/deliverables/${id}`, payload);
  },
  remove(id) {
    return api.delete(`/deliverables/${id}`);
  },
  createRevision(id, payload) {
    return api.post(`/deliverables/${id}/revisions`, payload);
  },
  updateRevision(id, revisionId, payload) {
    return api.put(`/deliverables/${id}/revisions/${revisionId}`, payload);
  },
};
