const API_URL = 'http://localhost:4000';
const AUTH_TOKEN_KEY = 'proyectomgm_auth_token';
let unauthorizedHandler = null;

export const authStorage = {
  getToken() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
  },
  setToken(token) {
    if (!token) return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  },
  clearToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  },
};

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

async function request(path, options = {}) {
  const { skipAuth = false, headers: customHeaders = {}, ...fetchOptions } = options;
  const headers = {
    ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...customHeaders,
  };

  const token = !skipAuth ? authStorage.getToken() : '';
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  const rawBody = await response.text();
  let json = null;

  if (rawBody) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new Error(
        rawBody.trim().startsWith('<')
          ? 'El servidor devolvió HTML en lugar de JSON. Revisa la consola del backend.'
          : 'La respuesta del servidor no es JSON válido.'
      );
    }
  }

  if (!response.ok || json?.success === false) {
    const error = new Error(json?.error || 'Request failed');
    error.status = response.status;

    if (response.status === 401 && !skipAuth) {
      authStorage.clearToken();
      unauthorizedHandler?.(error);
    }

    throw error;
  }

  return json?.data;
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
};
