import { api } from './api.js';

function buildQuery(params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || String(value).trim() === '') continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export const auditApi = {
  list(params = {}) {
    return api.get(`/audit-logs${buildQuery(params)}`);
  },
};
