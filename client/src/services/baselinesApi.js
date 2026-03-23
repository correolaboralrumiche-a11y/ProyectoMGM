import { api } from './api.js';

export const baselinesApi = {
  list(projectId) {
    return api.get(`/baselines?projectId=${encodeURIComponent(projectId)}`);
  },
  get(id) {
    return api.get(`/baselines/${id}`);
  },
  create(payload) {
    return api.post('/baselines', payload);
  },
  remove(id) {
    return api.delete(`/baselines/${id}`);
  },
};
