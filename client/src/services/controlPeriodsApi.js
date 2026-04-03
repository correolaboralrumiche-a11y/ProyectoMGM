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

export const controlPeriodsApi = {
  list(projectId) {
    return api.get(`/control-periods${buildQuery({ projectId })}`);
  },
  detail(id) {
    return api.get(`/control-periods/${id}`);
  },
  listDefinitions(projectId) {
    return api.get(`/control-periods/definitions${buildQuery({ projectId })}`);
  },
  createDefinition(payload) {
    return api.post('/control-periods/definitions', payload);
  },
  updateDefinition(id, payload) {
    return api.patch(`/control-periods/definitions/${id}`, payload);
  },
  deleteDefinition(id) {
    return api.delete(`/control-periods/definitions/${id}`);
  },
  capture(payload) {
    return api.post('/control-periods/capture', payload);
  },
  close(id, payload = {}) {
    return api.post(`/control-periods/${id}/close`, payload);
  },
  reopen(id, payload = {}) {
    return api.post(`/control-periods/${id}/reopen`, payload);
  },
  remove(id) {
    return api.delete(`/control-periods/${id}`);
  },
};
