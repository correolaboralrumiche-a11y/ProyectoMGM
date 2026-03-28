export function getErrorMessage(error, fallback = 'Ocurrió un error inesperado.') {
  if (!error) return fallback;

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error?.error === 'string' && error.error.trim()) {
    return error.error.trim();
  }

  return fallback;
}
