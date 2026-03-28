import { AppError } from '../errors/AppError.js';
import { hashSessionToken } from '../utils/sessionToken.js';
import { authRepository } from '../modules/auth/auth.repository.js';

function extractBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || '').trim();
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() != 'bearer') return null;

  return token.trim();
}

export async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const sessionContext = await authRepository.findSessionContextByTokenHash(hashSessionToken(token));
    if (!sessionContext) {
      throw new AppError('Session is invalid or expired', 401);
    }

    await authRepository.touchSession(sessionContext.session_id);

    req.auth = sessionContext;
    req.authToken = token;
    return next();
  } catch (error) {
    return next(error);
  }
}
