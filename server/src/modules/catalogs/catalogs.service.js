import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { auditRepository } from '../audit/audit.repository.js';
import { catalogsRepository } from './catalogs.repository.js';
import { extractActorId } from '../../utils/audit.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCode(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

function normalizeSortOrder(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : fallback;
}

function catalogAuditSnapshot(catalogKey, item) {
  return {
    catalog_key: catalogKey,
    code: item.code,
    name: item.name,
    description: item.description || '',
    is_active: Boolean(item.is_active),
    sort_order: Number(item.sort_order || 0),
  };
}

async function ensureDefinition(catalogKey) {
  try {
    return catalogsRepository.getDefinition(catalogKey);
  } catch {
    throw new AppError('Catalog not found', 404);
  }
}

async function ensureItemExists(catalogKey, code, executor) {
  const item = await catalogsRepository.findByCode(catalogKey, code, executor);
  if (!item) {
    throw new AppError('Catalog item not found', 404);
  }
  return item;
}

function validatePayload(payload, { requireCode = true } = {}) {
  const code = normalizeCode(payload?.code);
  const name = normalizeText(payload?.name);
  const description = normalizeText(payload?.description);
  const is_active = normalizeBoolean(payload?.is_active, true);
  const sort_order = normalizeSortOrder(payload?.sort_order, 0);

  if (requireCode && !code) {
    throw new AppError('Catalog item code is required', 400);
  }

  if (!name) {
    throw new AppError('Catalog item name is required', 400);
  }

  return {
    code,
    name,
    description,
    is_active,
    sort_order,
  };
}

export const catalogsService = {
  async listCatalogs() {
    const definitions = catalogsRepository.listDefinitions();

    const items = await Promise.all(
      definitions.map(async (definition) => {
        const rows = await catalogsRepository.listItems(definition.key, { includeInactive: true });
        const enriched = await Promise.all(
          rows.map(async (row) => ({
            ...row,
            usage_count: await catalogsRepository.countUsage(definition.key, row.code),
          }))
        );

        return {
          ...definition,
          items: enriched,
        };
      })
    );

    return items;
  },

  async listCatalogItems(catalogKey, includeInactive = true) {
    const definition = await ensureDefinition(catalogKey);
    const rows = await catalogsRepository.listItems(catalogKey, { includeInactive });
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        usage_count: await catalogsRepository.countUsage(catalogKey, row.code),
      }))
    );

    return {
      ...definition,
      items: enriched,
    };
  },

  async createCatalogItem(catalogKey, payload, actor, requestContext = {}) {
    const definition = await ensureDefinition(catalogKey);
    const normalized = validatePayload(payload, { requireCode: true });
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const duplicate = await catalogsRepository.findByCode(catalogKey, normalized.code, client);
      if (duplicate) {
        throw new AppError('Catalog item code already exists', 409);
      }

      const created = await catalogsRepository.createItem(
        catalogKey,
        {
          ...normalized,
          created_by: actorId,
          updated_by: actorId,
        },
        client
      );

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: definition.entity_type,
          entity_id: created.code,
          action: 'create',
          summary: `Catalog item created: ${definition.label} / ${created.name}`,
          before_data: null,
          after_data: catalogAuditSnapshot(catalogKey, created),
          metadata: { catalog_key: catalogKey },
          ...requestContext,
        },
        client
      );

      return created;
    });
  },

  async updateCatalogItem(catalogKey, itemCode, payload, actor, requestContext = {}) {
    const definition = await ensureDefinition(catalogKey);
    const normalizedCode = normalizeCode(itemCode);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureItemExists(catalogKey, normalizedCode, client);
      const normalized = validatePayload(
        {
          ...existing,
          ...payload,
          code: existing.code,
        },
        { requireCode: false }
      );

      if (existing.is_active && normalized.is_active === false) {
        const usageCount = await catalogsRepository.countUsage(catalogKey, existing.code, client);
        if (usageCount > 0) {
          throw new AppError('Cannot deactivate a catalog item that is currently in use', 409, {
            usage_count: usageCount,
          });
        }
      }

      const updated = await catalogsRepository.updateItem(
        catalogKey,
        existing.code,
        {
          ...normalized,
          updated_by: actorId,
        },
        client
      );

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: definition.entity_type,
          entity_id: updated.code,
          action: 'update',
          summary: `Catalog item updated: ${definition.label} / ${updated.name}`,
          before_data: catalogAuditSnapshot(catalogKey, existing),
          after_data: catalogAuditSnapshot(catalogKey, updated),
          metadata: { catalog_key: catalogKey },
          ...requestContext,
        },
        client
      );

      return updated;
    });
  },
};
