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
    priority_code: project.priority_code,
    priority_name: project.priority_name || null,
    currency_code: project.currency_code,
    currency_name: project.currency_name || null,
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

async function resolveCatalogCode(catalogKey, value, fallback, executor, options = {}) {
  const { label = catalogKey } = options;
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return fallback;
  }

  const normalizedCode = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const byCode = await catalogsRepository.findByCode(catalogKey, normalizedCode, executor);
  if (byCode?.is_active) return byCode.code;

  const byCodeExact = await catalogsRepository.findByCode(catalogKey, trimmed, executor);
  if (byCodeExact?.is_active) return byCodeExact.code;

  const byName = await catalogsRepository.findByName(catalogKey, trimmed, executor);
  if (byName?.is_active) return byName.code;

  const allowed = await catalogsRepository.listItems(catalogKey, { includeInactive: false }, executor);
  throw new AppError(`Invalid ${label}`, 400, {
    allowed_values: allowed.map((item) => ({ code: item.code, name: item.name })),
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
      const status_code = await resolveCatalogCode(
        'project-statuses',
        payload?.status ?? payload?.status_code,
        'active',
        client,
        { label: 'project status' }
      );
      const priority_code = await resolveCatalogCode(
        'project-priorities',
        payload?.priority ?? payload?.priority_code,
        'medium',
        client,
        { label: 'project priority' }
      );
      const currency_code = await resolveCatalogCode(
        'currencies',
        payload?.currency ?? payload?.currency_code,
        'USD',
        client,
        { label: 'project currency' }
      );

      const created = await projectsRepository.create(
        {
          code,
          name,
          description,
          status_code,
          priority_code,
          currency_code,
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
      const status_code = await resolveCatalogCode(
        'project-statuses',
        payload?.status ?? payload?.status_code ?? existing.status_code,
        'active',
        client,
        { label: 'project status' }
      );
      const priority_code = await resolveCatalogCode(
        'project-priorities',
        payload?.priority ?? payload?.priority_code ?? existing.priority_code,
        'medium',
        client,
        { label: 'project priority' }
      );
      const currency_code = await resolveCatalogCode(
        'currencies',
        payload?.currency ?? payload?.currency_code ?? existing.currency_code,
        'USD',
        client,
        { label: 'project currency' }
      );

      const updated = await projectsRepository.update(
        id,
        {
          name,
          description,
          status_code,
          priority_code,
          currency_code,
          updated_by: actorId,
        },
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
