import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

const POSTGRES_ERROR_MAP = {
  '23505': { status: 409, message: 'Unique constraint violation' },
  '23503': { status: 400, message: 'Invalid reference' },
  '23514': { status: 400, message: 'Check constraint violation' },
  '23502': { status: 400, message: 'Required value is missing' },
  '22P02': { status: 400, message: 'Invalid input format' },
};

function buildConstraintMessage(err) {
  const constraint = String(err?.constraint || '').trim();
  if (!constraint) return null;

  if (constraint.includes('activity_id')) {
    return 'Activity ID must be unique within the project';
  }

  if (constraint.includes('project_baselines') && constraint.includes('name')) {
    return 'A baseline with that name already exists for the project';
  }

  if (constraint.includes('ux_activities_wbs_sort_order')) {
    return 'Activity ordering conflict detected. Please try again.';
  }

  if (
    constraint.includes('ux_wbs_nodes_root_sort_order') ||
    constraint.includes('ux_wbs_nodes_child_sort_order')
  ) {
    return 'WBS ordering conflict detected. Please try again.';
  }

  if (constraint.includes('projects_code')) {
    return 'Project code must be unique';
  }

  return null;
}

export function errorHandler(err, req, res, next) {
  let status = err instanceof AppError ? err.status : 500;
  let message = err instanceof AppError ? err.message : 'Internal server error';

  if (err?.code && POSTGRES_ERROR_MAP[err.code]) {
    status = POSTGRES_ERROR_MAP[err.code].status;
    message = buildConstraintMessage(err) || POSTGRES_ERROR_MAP[err.code].message;
  }

  const logPayload = {
    request_id: req?.requestId || null,
    method: req?.method || null,
    url: req?.originalUrl || req?.url || null,
    status,
    error_name: err?.name || 'Error',
    message: err?.message || message,
    details: err instanceof AppError ? err.details || null : null,
    stack: err?.stack || null,
  };

  if (status >= 500) {
    logger.error('Unhandled request error', logPayload);
  } else {
    logger.warn('Handled request error', logPayload);
  }

  return res.status(status).json({
    success: false,
    error: message,
    request_id: req?.requestId || null,
    ...(err instanceof AppError && err.details ? { details: err.details } : {}),
  });
}
