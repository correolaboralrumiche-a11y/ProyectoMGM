import { logger } from '../utils/logger.js';

function computeDurationMs(startedAt) {
  if (!startedAt) return null;

  try {
    const diffNs = process.hrtime.bigint() - startedAt;
    return Number(diffNs / 1000000n);
  } catch {
    return null;
  }
}

export function requestLogger(req, res, next) {
  const startedAt = req.requestStartedAt;

  res.on('finish', () => {
    const durationMs = computeDurationMs(startedAt);
    const authUser = req.auth?.user || null;

    logger.info('HTTP request completed', {
      request_id: req.requestId || null,
      method: req.method,
      url: req.originalUrl || req.url,
      status_code: res.statusCode,
      duration_ms: durationMs,
      user_id: authUser?.id || null,
      username: authUser?.username || null,
      ip_address: req.ip || null,
    });
  });

  return next();
}
