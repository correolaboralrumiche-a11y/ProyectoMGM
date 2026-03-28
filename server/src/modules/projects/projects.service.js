import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { projectsRepository } from './projects.repository.js';
import { catalogsRepository } from '../catalogs/catalogs.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { extractActorId } from '../../utils/audit.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDescription(value) {
  return String(value || '').trim();
}

function slugifyForCode(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

function projectAuditSnapshot(project) {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    description: project.description || '',
    status_code: project.status_code,
    status_name: project.status_name || project.status,
  };
}

async function buildUniqueProjectCode(name) {
  const baseSlug = slugifyForCode(name) || 'PROJECT';
  const baseCode = `PRJ_${baseSlug}`;

  let candidate = baseCode;
  let counter = 2;

  while (await projectsRepository.findByCode(candidate)) {
    candidate = `${baseCode}_${String(counter).padStart(2, '0')}`;
    counter += 1;
  }

  return candidate;
}

async function resolveProjectStatusCode(value, executor) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'active';

  const byCode = await catalogsRepository.findByCode('project-statuses', normalized, executor);
  if (byCode?.is_active) return byCode.code;

  const byName = await catalogsRepository.findByName('project-statuses', value, executor);
  if (byName?.is_active) return byName.code;

  const allowed = await catalogsRepository.listItems('project-statuses', { includeInactive: false }, executor);
  throw new AppError('Invalid project status', 400, {
    allowed_statuses: allowed.map((item) => ({ code: item.code, name: item.name })),
  });
}

export const projectsService = {
  async listProjects() {
    return projectsRepository.list();
  },

  async createProject(payload, actor, requestContext = {}) {
    const name = normalizeText(payload?.name);
    const description = normalizeDescription(payload?.description);

    if (!name) {
      throw new AppError('Project name is required', 400);
    }

    const code = await buildUniqueProjectCode(name);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const status_code = await resolveProjectStatusCode(payload?.status ?? payload?.status_code, client);

      const created = await projectsRepository.create(
        {
          code,
          name,
          description,
          status_code,
          created_by: actorId,
          updated_by: actorId,
        },
        client
      );

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'project',
          entity_id: created.id,
          project_id: created.id,
          action: 'create',
          summary: `Project created: ${created.name}`,
          before_data: null,
          after_data: projectAuditSnapshot(created),
          metadata: { code: created.code },
          ...requestContext,
        },
        client
      );

      return created;
    });
  },

  async updateProject(id, payload, actor, requestContext = {}) {
    const existing = await projectsRepository.findById(id);

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    const name = normalizeText(payload?.name ?? existing.name);
    const description = normalizeDescription(payload?.description ?? existing.description);

    if (!name) {
      throw new AppError('Project name is required', 400);
    }

    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const status_code = await resolveProjectStatusCode(
        payload?.status ?? payload?.status_code ?? existing.status_code,
        client
      );

      const updated = await projectsRepository.update(
        id,
        { name, description, status_code, updated_by: actorId },
        client
      );

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'project',
          entity_id: updated.id,
          project_id: updated.id,
          action: 'update',
          summary: `Project updated: ${updated.name}`,
          before_data: projectAuditSnapshot(existing),
          after_data: projectAuditSnapshot(updated),
          ...requestContext,
        },
        client
      );

      return updated;
    });
  },

  async deleteProject(id, actor, requestContext = {}) {
    const existing = await projectsRepository.findById(id);

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    const actorId = extractActorId(actor);

    await withTransaction(async (client) => {
      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'project',
          entity_id: existing.id,
          project_id: existing.id,
          action: 'delete',
          summary: `Project deleted: ${existing.name}`,
          before_data: projectAuditSnapshot(existing),
          after_data: null,
          ...requestContext,
        },
        client
      );

      await projectsRepository.remove(id, client);
    });

    return { id };
  },
};
