import { AppError } from '../errors/AppError.js';
import { actorHasPermission, actorHasRole } from '../utils/access.js';

export { actorHasPermission, actorHasRole };

export function requirePermission(...permissionCodes) {
  const expected = permissionCodes
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  return (req, res, next) => {
    const session = req.auth;
    if (!session?.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!expected.length) {
      return next();
    }

    const allowed = expected.some((code) => actorHasPermission(session, code));

    if (!allowed) {
      return next(new AppError('Forbidden', 403));
    }

    return next();
  };
}
