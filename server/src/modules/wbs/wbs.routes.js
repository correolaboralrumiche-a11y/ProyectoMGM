import { Router } from 'express';
import db from '../../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { ok, fail } from '../../utils/http.js';

const router = Router();

function getChildren(projectId, parentId) {
  if (parentId === null || parentId === undefined) {
    return db.prepare(`
      SELECT *
      FROM wbs
      WHERE project_id = ?
        AND parent_id IS NULL
      ORDER BY sort_order ASC, name ASC
    `).all(projectId);
  }

  return db.prepare(`
    SELECT *
    FROM wbs
    WHERE project_id = ?
      AND parent_id = ?
    ORDER BY sort_order ASC, name ASC
  `).all(projectId, parentId);
}

function getMaxSortOrder(projectId, parentId) {
  if (parentId === null || parentId === undefined) {
    const row = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) AS value
      FROM wbs
      WHERE project_id = ?
        AND parent_id IS NULL
    `).get(projectId);
    return row?.value || 0;
  }

  const row = db.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) AS value
    FROM wbs
    WHERE project_id = ?
      AND parent_id = ?
  `).get(projectId, parentId);
  return row?.value || 0;
}

function buildTree(projectId, parentId = null) {
  const children = getChildren(projectId, parentId);
  return children.map((node) => ({
    ...node,
    children: buildTree(projectId, node.id),
  }));
}

function normalizeSiblingSortOrders(projectId, parentId) {
  const siblings = getChildren(projectId, parentId);
  const updateStmt = db.prepare('UPDATE wbs SET sort_order = ? WHERE id = ?');

  siblings.forEach((sibling, index) => {
    const nextSortOrder = index + 1;
    if (sibling.sort_order !== nextSortOrder) {
      updateStmt.run(nextSortOrder, sibling.id);
    }
  });
}

function parseLastNumericSegment(code) {
  if (!code) return null;
  const parts = String(code).split('.');
  const last = Number(parts[parts.length - 1]);
  return Number.isInteger(last) ? last : null;
}

function getNextCode(projectId, parentId) {
  if (parentId === null || parentId === undefined) {
    const roots = getChildren(projectId, null);
    const maxRoot = roots.reduce((maxValue, node) => {
      const value = parseLastNumericSegment(node.code);
      return value && value > maxValue ? value : maxValue;
    }, 0);
    return String(maxRoot + 1);
  }

  const parent = db.prepare('SELECT * FROM wbs WHERE id = ?').get(parentId);
  if (!parent) {
    throw new Error('Parent WBS not found');
  }

  const siblings = getChildren(parent.project_id, parentId);
  const parentPrefix = parent.code ? `${parent.code}.` : '';

  const maxSuffix = siblings.reduce((maxValue, node) => {
    if (!node.code || !String(node.code).startsWith(parentPrefix)) {
      return maxValue;
    }

    const suffix = String(node.code).slice(parentPrefix.length);
    if (!/^\d+$/.test(suffix)) {
      return maxValue;
    }

    const value = Number(suffix);
    return value > maxValue ? value : maxValue;
  }, 0);

  return `${parent.code}.${maxSuffix + 1}`;
}

function canAssignParent(projectId, nodeId, newParentId) {
  if (!newParentId) return true;
  if (nodeId === newParentId) return false;

  const parentNode = db.prepare('SELECT * FROM wbs WHERE id = ?').get(newParentId);
  if (!parentNode) return false;
  if (parentNode.project_id !== projectId) return false;

  let current = parentNode;
  while (current) {
    if (current.id === nodeId) return false;
    if (!current.parent_id) break;
    current = db.prepare('SELECT * FROM wbs WHERE id = ?').get(current.parent_id);
  }

  return true;
}

function moveNodeWithinSiblings(node, direction) {
  const siblings = getChildren(node.project_id, node.parent_id);
  const currentIndex = siblings.findIndex((item) => item.id === node.id);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= siblings.length) {
    return false;
  }

  const target = siblings[targetIndex];
  const updateStmt = db.prepare('UPDATE wbs SET sort_order = ? WHERE id = ?');

  updateStmt.run(target.sort_order, node.id);
  updateStmt.run(node.sort_order, target.id);
  normalizeSiblingSortOrders(node.project_id, node.parent_id);

  return true;
}

const normalizeParentsTx = db.transaction((projectId, parentIds = []) => {
  const uniqueParentIds = [...new Set(parentIds.map((item) => item ?? null))];
  uniqueParentIds.forEach((parentId) => normalizeSiblingSortOrders(projectId, parentId));
});

router.get('/', (req, res) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId) return fail(res, 'projectId is required');

    const tree = buildTree(projectId);
    return ok(res, tree);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.post('/', (req, res) => {
  try {
    const projectId = String(req.body?.project_id || '').trim();
    const parentId = req.body?.parent_id ?? null;
    const name = String(req.body?.name || '').trim();

    if (!projectId) return fail(res, 'project_id is required');
    if (!name) return fail(res, 'WBS name is required');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return fail(res, 'Project not found', 404);

    if (parentId) {
      const parent = db.prepare('SELECT * FROM wbs WHERE id = ?').get(parentId);
      if (!parent) return fail(res, 'Parent WBS not found', 404);
      if (parent.project_id !== projectId) return fail(res, 'Parent project mismatch');
    }

    const id = uuidv4();
    const sortOrder = getMaxSortOrder(projectId, parentId) + 1;
    const code = getNextCode(projectId, parentId);

    db.prepare(`
      INSERT INTO wbs (id, project_id, parent_id, name, code, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, parentId, name, code, sortOrder);

    normalizeParentsTx(projectId, [parentId]);

    const created = db.prepare('SELECT * FROM wbs WHERE id = ?').get(id);
    return ok(res, created, 201);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.put('/:id', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM wbs WHERE id = ?').get(req.params.id);
    if (!node) return fail(res, 'WBS not found', 404);

    const name = String(req.body?.name ?? node.name).trim();
    const parentId = Object.prototype.hasOwnProperty.call(req.body || {}, 'parent_id')
      ? (req.body.parent_id ?? null)
      : node.parent_id;

    if (!name) return fail(res, 'WBS name is required');
    if (!canAssignParent(node.project_id, node.id, parentId)) {
      return fail(res, 'Invalid parent assignment');
    }

    let sortOrder = node.sort_order;
    if (parentId !== node.parent_id) {
      sortOrder = getMaxSortOrder(node.project_id, parentId) + 1;
    }

    db.prepare(`
      UPDATE wbs
      SET name = ?, parent_id = ?, sort_order = ?
      WHERE id = ?
    `).run(name, parentId, sortOrder, node.id);

    normalizeParentsTx(node.project_id, [node.parent_id, parentId]);

    const updated = db.prepare('SELECT * FROM wbs WHERE id = ?').get(node.id);
    return ok(res, updated);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.post('/:id/indent', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM wbs WHERE id = ?').get(req.params.id);
    if (!node) return fail(res, 'WBS not found', 404);

    const prevSibling = db.prepare(`
      SELECT *
      FROM wbs
      WHERE project_id = ?
        AND (
          (parent_id IS NULL AND ? IS NULL)
          OR parent_id = ?
        )
        AND sort_order < ?
      ORDER BY sort_order DESC
      LIMIT 1
    `).get(node.project_id, node.parent_id, node.parent_id, node.sort_order);

    if (!prevSibling) return fail(res, 'No previous sibling to indent under');

    const newSortOrder = getMaxSortOrder(node.project_id, prevSibling.id) + 1;

    db.prepare(`
      UPDATE wbs
      SET parent_id = ?, sort_order = ?
      WHERE id = ?
    `).run(prevSibling.id, newSortOrder, node.id);

    normalizeParentsTx(node.project_id, [node.parent_id, prevSibling.id]);

    const updated = db.prepare('SELECT * FROM wbs WHERE id = ?').get(node.id);
    return ok(res, updated);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.post('/:id/outdent', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM wbs WHERE id = ?').get(req.params.id);
    if (!node) return fail(res, 'WBS not found', 404);
    if (!node.parent_id) return fail(res, 'Node is already at root level');

    const parent = db.prepare('SELECT * FROM wbs WHERE id = ?').get(node.parent_id);
    if (!parent) return fail(res, 'Parent WBS not found', 404);

    const newParentId = parent.parent_id ?? null;
    const newSortOrder = parent.sort_order + 1;

    db.prepare(`
      UPDATE wbs
      SET parent_id = ?, sort_order = ?
      WHERE id = ?
    `).run(newParentId, newSortOrder, node.id);

    normalizeParentsTx(node.project_id, [node.parent_id, newParentId]);

    const updated = db.prepare('SELECT * FROM wbs WHERE id = ?').get(node.id);
    return ok(res, updated);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.post('/:id/move-up', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM wbs WHERE id = ?').get(req.params.id);
    if (!node) return fail(res, 'WBS not found', 404);

    const moved = moveNodeWithinSiblings(node, 'up');
    if (!moved) return fail(res, 'Node is already at the top of its level');

    const updated = db.prepare('SELECT * FROM wbs WHERE id = ?').get(node.id);
    return ok(res, updated);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.post('/:id/move-down', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM wbs WHERE id = ?').get(req.params.id);
    if (!node) return fail(res, 'WBS not found', 404);

    const moved = moveNodeWithinSiblings(node, 'down');
    if (!moved) return fail(res, 'Node is already at the bottom of its level');

    const updated = db.prepare('SELECT * FROM wbs WHERE id = ?').get(node.id);
    return ok(res, updated);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.delete('/:id', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM wbs WHERE id = ?').get(req.params.id);
    if (!node) return fail(res, 'WBS not found', 404);

    db.prepare('DELETE FROM wbs WHERE id = ?').run(node.id);
    normalizeParentsTx(node.project_id, [node.parent_id]);

    return ok(res, { id: node.id });
  } catch (error) {
    return fail(res, error, 500);
  }
});

export default router;
