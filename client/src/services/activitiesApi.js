import { api } from './api';

export const activitiesApi = {
  list: (projectId) => api.get(`/activities?projectId=${projectId}`),
  create: (payload) => api.post('/activities', payload),
  update: (id, payload) => api.put(`/activities/${id}`, payload),
  remove: (id) => api.delete(`/activities/${id}`),
  moveUp: (id) => api.post(`/activities/${id}/move-up`, {}),
  moveDown: (id) => api.post(`/activities/${id}/move-down`, {}),
};
