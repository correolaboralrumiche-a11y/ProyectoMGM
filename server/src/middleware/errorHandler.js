import { AppError } from '../errors/AppError.js';

export function errorHandler(err, req, res, next) {
  let status = err instanceof AppError ? err.status : 500;
  let message = err instanceof AppError ? err.message : 'Internal server error';

  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    status = 409;
    message = 'Unique constraint violation';
  } else if (err?.code === 'SQLITE_CONSTRAINT_CHECK') {
    status = 400;
    message = 'Check constraint violation';
  } else if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    status = 400;
    message = 'Invalid reference';
  }

  console.error(err);

  res.status(status).json({
    success: false,
    error: message,
    ...(err instanceof AppError && err.details ? { details: err.details } : {}),
  });
}