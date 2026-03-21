import { api } from './api';

export const wbsApi = {
  list: (projectId) => api.get(`/wbs?projectId=${projectId}`),
  create: (payload) => api.post('/wbs', payload),
  update: (id, payload) => api.put(`/wbs/${id}`, payload),
  remove: (id) => api.delete(`/wbs/${id}`),
  indent: (id) => api.post(`/wbs/${id}/indent`, {}),
  outdent: (id) => api.post(`/wbs/${id}/outdent`, {}),
  moveUp: (id) => api.post(`/wbs/${id}/move-up`, {}),
  moveDown: (id) => api.post(`/wbs/${id}/move-down`, {}),
};
