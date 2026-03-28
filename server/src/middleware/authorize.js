import { AppError } from '../errors/AppError.js';

export function requirePermission(...permissionCodes) {
  const expected = permissionCodes.filter(Boolean);

  return (req, res, next) => {
    const session = req.auth;
    if (!session?.user) {
      return next(new AppError('Authentication required', 401));
    }

    const roles = new Set((session.user.roles || []).map((value) => String(value || '').toLowerCase()));
    if (roles.has('admin')) {
      return next();
    }

    if (!expected.length) {
      return next();
    }

    const permissions = new Set((session.user.permissions || []).map((value) => String(value || '').trim()));
    const allowed = expected.some((code) => permissions.has(code));

    if (!allowed) {
      return next(new AppError('Forbidden', 403));
    }

    return next();
  };
}
