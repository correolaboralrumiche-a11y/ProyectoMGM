const API_URL = 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
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
    throw new Error(json?.error || 'Request failed');
  }

  return json?.data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: (path, body) =>
    request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (path) =>
    request(path, {
      method: 'DELETE',
    }),
};
