import { AppError } from '../errors/AppError.js';
import { isAdminActor } from './access.js';

function normalizeProjectStatus(project) {
  return String(project?.status_code || project?.status || 'active').trim().toLowerCase();
}

export function isProjectOperationallyLocked(project) {
  return normalizeProjectStatus(project) !== 'active';
}

export function ensureProjectOperationallyEditable(project, actor, operationLabel = 'operation') {
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (isAdminActor(actor)) {
    return project;
  }

  const projectStatus = normalizeProjectStatus(project);
  if (projectStatus === 'active') {
    return project;
  }

  throw new AppError(
    `Project \"${project.name || project.code || project.id}\" is read-only for ${operationLabel} while status is ${projectStatus}`,
    409,
    {
      project_id: project.id,
      project_status: projectStatus,
      operation: operationLabel,
    }
  );
}
