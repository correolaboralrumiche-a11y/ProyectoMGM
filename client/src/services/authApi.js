import { api, authStorage } from './api.js';

export const authApi = {
  async login(payload) {
    const data = await api.post('/auth/login', payload, { skipAuth: true });
    if (data?.token) {
      authStorage.setToken(data.token);
    }
    return data;
  },

  me() {
    return api.get('/auth/me');
  },

  async logout() {
    try {
      await api.post('/auth/logout', {});
    } finally {
      authStorage.clearToken();
    }
  },
};
