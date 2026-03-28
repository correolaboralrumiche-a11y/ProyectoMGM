import { pool } from '../../config/db.js';

export const CATALOG_DEFINITIONS = {
  'project-statuses': {
    key: 'project-statuses',
    table: 'project_statuses',
    label: 'Estados de proyecto',
    entity_type: 'catalog.project_status',
    usage: { table: 'projects', column: 'status' },
  },
  'activity-statuses': {
    key: 'activity-statuses',
    table: 'activity_statuses',
    label: 'Estados de actividad',
    entity_type: 'catalog.activity_status',
    usage: { table: 'activities', column: 'status' },
  },
  'activity-types': {
    key: 'activity-types',
    table: 'activity_types',
    label: 'Tipos de actividad',
    entity_type: 'catalog.activity_type',
    usage: { table: 'activities', column: 'activity_type_code' },
  },
  'activity-priorities': {
    key: 'activity-priorities',
    table: 'activity_priorities',
    label: 'Prioridades de actividad',
    entity_type: 'catalog.activity_priority',
    usage: { table: 'activities', column: 'priority_code' },
  },
};

function getDefinition(catalogKey) {
  const definition = CATALOG_DEFINITIONS[catalogKey];
  if (!definition) {
    throw new Error(`Unknown catalog: ${catalogKey}`);
  }

  return definition;
}

function mapItem(row) {
  if (!row) return null;

  return {
    code: row.code,
    name: row.name,
    description: row.description || '',
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order || 0),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const catalogsRepository = {
  getDefinition,

  listDefinitions() {
    return Object.values(CATALOG_DEFINITIONS).map((definition) => ({
      key: definition.key,
      label: definition.label,
    }));
  },

  async listItems(catalogKey, options = {}, executor = pool) {
    const definition = getDefinition(catalogKey);
    const includeInactive = Boolean(options.includeInactive);

    const result = await executor.query(
      `
        SELECT
          code,
          name,
          description,
          is_active,
          sort_order,
          created_by,
          updated_by,
          created_at,
          updated_at
        FROM ${definition.table}
        ${includeInactive ? '' : 'WHERE is_active = TRUE'}
        ORDER BY sort_order ASC, LOWER(name) ASC, code ASC
      `
    );

    return result.rows.map(mapItem);
  },

  async findByCode(catalogKey, code, executor = pool) {
    const definition = getDefinition(catalogKey);
    const result = await executor.query(
      `
        SELECT
          code,
          name,
          description,
          is_active,
          sort_order,
          created_by,
          updated_by,
          created_at,
          updated_at
        FROM ${definition.table}
        WHERE code = $1
      `,
      [code]
    );

    return mapItem(result.rows[0]);
  },

  async findByName(catalogKey, name, executor = pool) {
    const definition = getDefinition(catalogKey);
    const result = await executor.query(
      `
        SELECT
          code,
          name,
          description,
          is_active,
          sort_order,
          created_by,
          updated_by,
          created_at,
          updated_at
        FROM ${definition.table}
        WHERE LOWER(name) = LOWER($1)
      `,
      [name]
    );

    return mapItem(result.rows[0]);
  },

  async createItem(catalogKey, item, executor = pool) {
    const definition = getDefinition(catalogKey);
    const result = await executor.query(
      `
        INSERT INTO ${definition.table} (
          code,
          name,
          description,
          is_active,
          sort_order,
          created_by,
          updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          code,
          name,
          description,
          is_active,
          sort_order,
          created_by,
          updated_by,
          created_at,
          updated_at
      `,
      [
        item.code,
        item.name,
        item.description || '',
        item.is_active,
        item.sort_order,
        item.created_by || null,
        item.updated_by || null,
      ]
    );

    return mapItem(result.rows[0]);
  },

  async updateItem(catalogKey, currentCode, item, executor = pool) {
    const definition = getDefinition(catalogKey);
    const result = await executor.query(
      `
        UPDATE ${definition.table}
        SET
          name = $2,
          description = $3,
          is_active = $4,
          sort_order = $5,
          updated_by = $6,
          updated_at = NOW()
        WHERE code = $1
        RETURNING
          code,
          name,
          description,
          is_active,
          sort_order,
          created_by,
          updated_by,
          created_at,
          updated_at
      `,
      [
        currentCode,
        item.name,
        item.description || '',
        item.is_active,
        item.sort_order,
        item.updated_by || null,
      ]
    );

    return mapItem(result.rows[0]);
  },

  async countUsage(catalogKey, code, executor = pool) {
    const definition = getDefinition(catalogKey);
    const result = await executor.query(
      `
        SELECT COUNT(*)::int AS count
        FROM ${definition.usage.table}
        WHERE ${definition.usage.column} = $1
      `,
      [code]
    );

    return Number(result.rows[0]?.count || 0);
  },
};
