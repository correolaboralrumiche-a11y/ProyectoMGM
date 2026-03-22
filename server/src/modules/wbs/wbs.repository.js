import db from '../../config/db.js';

function getParentPredicate(parentId) {
  return parentId === null || parentId === undefined
    ? {
        clause: 'parent_id IS NULL',
        params: [],
      }
    : {
        clause: 'parent_id = ?',
        params: [parentId],
      };
}

export const wbsRepository = {
  findProjectById(projectId) {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) || null;
  },

  listByProject(projectId) {
    return db
      .prepare(`
        SELECT *
        FROM wbs
        WHERE project_id = ?
        ORDER BY parent_id IS NOT NULL, parent_id, sort_order, name, id
      `)
      .all(projectId);
  },

  findById(id) {
    return db.prepare('SELECT * FROM wbs WHERE id = ?').get(id) || null;
  },

  listChildren(projectId, parentId) {
    const predicate = getParentPredicate(parentId);
    return db
      .prepare(`
        SELECT *
        FROM wbs
        WHERE project_id = ?
          AND ${predicate.clause}
        ORDER BY sort_order ASC, name ASC, id ASC
      `)
      .all(projectId, ...predicate.params);
  },

  getMaxSortOrder(projectId, parentId) {
    const predicate = getParentPredicate(parentId);
    const row = db
      .prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS value
        FROM wbs
        WHERE project_id = ?
          AND ${predicate.clause}
      `)
      .get(projectId, ...predicate.params);

    return Number(row?.value || 0);
  },

  create(node) {
    db.prepare(`
      INSERT INTO wbs (id, project_id, parent_id, name, code, sort_order)
      VALUES (@id, @project_id, @parent_id, @name, @code, @sort_order)
    `).run(node);

    return this.findById(node.id);
  },

  update(nodeId, changes) {
    db.prepare(`
      UPDATE wbs
      SET name = ?, parent_id = ?, code = ?, sort_order = ?
      WHERE id = ?
    `).run(changes.name, changes.parent_id, changes.code, changes.sort_order, nodeId);

    return this.findById(nodeId);
  },

  updateHierarchy(nodeId, parentId, sortOrder) {
    db.prepare(`
      UPDATE wbs
      SET parent_id = ?, sort_order = ?
      WHERE id = ?
    `).run(parentId, sortOrder, nodeId);
  },

  updateSortOrder(nodeId, sortOrder) {
    db.prepare('UPDATE wbs SET sort_order = ? WHERE id = ?').run(sortOrder, nodeId);
  },

  updateCodeAndSort(nodeId, code, sortOrder) {
    db.prepare(`
      UPDATE wbs
      SET code = ?, sort_order = ?
      WHERE id = ?
    `).run(code, sortOrder, nodeId);
  },

  incrementSortOrdersFrom(projectId, parentId, startAt) {
    const predicate = getParentPredicate(parentId);
    db.prepare(`
      UPDATE wbs
      SET sort_order = sort_order + 1
      WHERE project_id = ?
        AND ${predicate.clause}
        AND sort_order >= ?
    `).run(projectId, ...predicate.params, startAt);
  },

  remove(id) {
    db.prepare('DELETE FROM wbs WHERE id = ?').run(id);
  },

  transaction(callback) {
    return db.transaction(callback)();
  },
};