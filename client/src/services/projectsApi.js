import { api } from './api';

export const projectsApi = {
  list: () => api.get('/projects'),
  create: (payload) => api.post('/projects', payload),
  update: (id, payload) => api.put(`/projects/${id}`, payload),
  remove: (id) => api.delete(`/projects/${id}`),
};
