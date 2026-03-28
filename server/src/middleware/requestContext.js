import crypto from 'crypto';

function normalizeRequestId(value) {
  const candidate = String(value || '').trim();
  return candidate && candidate.length <= 100 ? candidate : null;
}

export function requestContext(req, res, next) {
  const incomingRequestId = normalizeRequestId(req.headers['x-request-id']);
  const requestId = incomingRequestId || crypto.randomUUID();

  req.requestId = requestId;
  req.requestStartedAt = process.hrtime.bigint();

  res.setHeader('X-Request-Id', requestId);

  return next();
}
