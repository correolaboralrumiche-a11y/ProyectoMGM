import { pool, withTransaction } from '../../config/db.js';

function mapWbsNode(row) {
  if (!row) return null;

  return {
    id: row.id,
    project_id: row.project_id,
    parent_id: row.parent_id,
    name: row.name,
    code: row.code,
    sort_order: Number(row.sort_order || 0),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildParentClause(parentId, startIndex = 2) {
  if (parentId === null || parentId === undefined) {
    return {
      clause: 'parent_id IS NULL',
      params: [],
      nextIndex: startIndex,
    };
  }

  return {
    clause: `parent_id = $${startIndex}`,
    params: [parentId],
    nextIndex: startIndex + 1,
  };
}

export const wbsRepository = {
  async findProjectById(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, code, name, description, status, created_at, updated_at
        FROM projects
        WHERE id = $1
      `,
      [projectId]
    );

    return result.rows[0] || null;
  },

  async listByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, parent_id, name, code, sort_order, created_by, updated_by, created_at, updated_at
        FROM wbs_nodes
        WHERE project_id = $1
        ORDER BY sort_order ASC, name ASC, id ASC
      `,
      [projectId]
    );

    return result.rows.map(mapWbsNode);
  },

  async findById(id, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, parent_id, name, code, sort_order, created_by, updated_by, created_at, updated_at
        FROM wbs_nodes
        WHERE id = $1
      `,
      [id]
    );

    return mapWbsNode(result.rows[0]);
  },

  async listChildren(projectId, parentId, executor = pool) {
    const predicate = buildParentClause(parentId, 2);
    const result = await executor.query(
      `
        SELECT id, project_id, parent_id, name, code, sort_order, created_by, updated_by, created_at, updated_at
        FROM wbs_nodes
        WHERE project_id = $1
          AND ${predicate.clause}
        ORDER BY sort_order ASC, name ASC, id ASC
      `,
      [projectId, ...predicate.params]
    );

    return result.rows.map(mapWbsNode);
  },

  async getMaxSortOrder(projectId, parentId, executor = pool) {
    const predicate = buildParentClause(parentId, 2);
    const result = await executor.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) AS value
        FROM wbs_nodes
        WHERE project_id = $1
          AND ${predicate.clause}
      `,
      [projectId, ...predicate.params]
    );

    return Number(result.rows[0]?.value || 0);
  },

  async create(node, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO wbs_nodes (project_id, parent_id, name, code, sort_order, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, project_id, parent_id, name, code, sort_order, created_by, updated_by, created_at, updated_at
      `,
      [
        node.project_id,
        node.parent_id,
        node.name,
        node.code,
        node.sort_order,
        node.created_by || null,
        node.updated_by || null,
      ]
    );

    return mapWbsNode(result.rows[0]);
  },

  async update(nodeId, changes, executor = pool) {
    const result = await executor.query(
      `
        UPDATE wbs_nodes
        SET
          name = $2,
          parent_id = $3,
          code = $4,
          sort_order = $5,
          updated_by = $6,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, project_id, parent_id, name, code, sort_order, created_by, updated_by, created_at, updated_at
      `,
      [
        nodeId,
        changes.name,
        changes.parent_id,
        changes.code,
        changes.sort_order,
        changes.updated_by || null,
      ]
    );

    return mapWbsNode(result.rows[0]);
  },

  async updateHierarchy(nodeId, parentId, sortOrder, updatedBy = null, executor = pool) {
    await executor.query(
      `
        UPDATE wbs_nodes
        SET
          parent_id = $2,
          sort_order = $3,
          updated_by = COALESCE($4, updated_by),
          updated_at = NOW()
        WHERE id = $1
      `,
      [nodeId, parentId, sortOrder, updatedBy]
    );
  },

  async updateSortOrder(nodeId, sortOrder, updatedBy = null, executor = pool) {
    await executor.query(
      `
        UPDATE wbs_nodes
        SET
          sort_order = $2,
          updated_by = COALESCE($3, updated_by),
          updated_at = NOW()
        WHERE id = $1
      `,
      [nodeId, sortOrder, updatedBy]
    );
  },

  async updateCodeAndSort(nodeId, code, sortOrder, updatedBy = null, executor = pool) {
    await executor.query(
      `
        UPDATE wbs_nodes
        SET
          code = $2,
          sort_order = $3,
          updated_by = COALESCE($4, updated_by),
          updated_at = NOW()
        WHERE id = $1
      `,
      [nodeId, code, sortOrder, updatedBy]
    );
  },

  async incrementSortOrdersFrom(projectId, parentId, startAt, updatedBy = null, executor = pool) {
    const predicate = buildParentClause(parentId, 2);
    await executor.query(
      `
        UPDATE wbs_nodes
        SET
          sort_order = sort_order + 1,
          updated_by = COALESCE($${predicate.nextIndex + 1}, updated_by),
          updated_at = NOW()
        WHERE project_id = $1
          AND ${predicate.clause}
          AND sort_order >= $${predicate.nextIndex}
      `,
      [projectId, ...predicate.params, startAt, updatedBy]
    );
  },

  async remove(id, executor = pool) {
    await executor.query(
      `
        DELETE FROM wbs_nodes
        WHERE id = $1
      `,
      [id]
    );
  },

  async transaction(callback) {
    return withTransaction(callback);
  },
};
