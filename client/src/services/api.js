import { showCopyableErrorDialog } from '../utils/error.js';

const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
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

function buildErrorFromResponse(response, json, rawBody, url) {
  const detailText = Array.isArray(json?.details?.allowed_statuses)
    ? ` Valores permitidos: ${json.details.allowed_statuses
        .map((item) => item.name || item.code)
        .join(', ')}.`
    : '';

  const error = new Error((json?.error || 'Request failed') + detailText);
  error.status = response.status;
  error.details = json?.details || null;
  error.requestId = json?.request_id || null;
  error.responseError = json?.error || null;
  error.debug = json?.debug || null;
  error.rawBody = rawBody || '';
  error.rawBodySnippet = typeof rawBody === 'string' ? rawBody.slice(0, 4000) : '';
  error.url = url;
  return error;
}

function maybeShowCopyableServerError(error, context) {
  if (typeof window === 'undefined') return;

  const shouldShow =
    error?.status >= 500 ||
    error?.message?.includes('HTML en lugar de JSON') ||
    error?.message?.includes('no es JSON válido');

  if (!shouldShow) return;
  showCopyableErrorDialog(error, context);
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

  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  const rawBody = await response.text();
  let json = null;

  if (rawBody) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      const error = new Error(
        rawBody.trim().startsWith('<')
          ? 'El servidor devolvió HTML en lugar de JSON. Revisa la consola del backend.'
          : 'La respuesta del servidor no es JSON válido.'
      );
      error.status = response.status;
      error.rawBody = rawBody;
      error.rawBodySnippet = rawBody.slice(0, 4000);
      error.url = url;
      maybeShowCopyableServerError(error, 'Error de respuesta del servidor');
      throw error;
    }
  }

  if (!response.ok || json?.success === false) {
    const error = buildErrorFromResponse(response, json || {}, rawBody, url);

    if (response.status === 401 && !skipAuth) {
      authStorage.clearToken();
      unauthorizedHandler?.(error);
    }

    maybeShowCopyableServerError(error, 'Error detectado por la API');
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
