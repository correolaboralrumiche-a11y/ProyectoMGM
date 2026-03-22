import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../errors/AppError.js';
import { wbsRepository } from './wbs.repository.js';

function buildTreeFromRows(rows) {
  const byParentKey = new Map();

  for (const row of rows) {
    const key = row.parent_id ?? '__root__';
    const bucket = byParentKey.get(key) || [];
    bucket.push(row);
    byParentKey.set(key, bucket);
  }

  for (const bucket of byParentKey.values()) {
    bucket.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
  }

  function visit(parentId = null, prefix = '') {
    const key = parentId ?? '__root__';
    const children = byParentKey.get(key) || [];

    return children.map((node, index) => {
      const sortOrder = index + 1;
      const code = prefix ? `${prefix}.${sortOrder}` : String(sortOrder);

      return {
        ...node,
        sort_order: sortOrder,
        code,
        children: visit(node.id, code),
      };
    });
  }

  return visit(null, '');
}

function flattenTree(tree) {
  const rows = [];

  function walk(nodes) {
    for (const node of nodes) {
      rows.push(node);
      walk(node.children || []);
    }
  }

  walk(tree);
  return rows;
}

function ensureProjectExists(projectId) {
  const project = wbsRepository.findProjectById(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  return project;
}

function ensureNodeExists(nodeId) {
  const node = wbsRepository.findById(nodeId);

  if (!node) {
    throw new AppError('WBS not found', 404);
  }

  return node;
}

function ensureValidParentAssignment(projectId, nodeId, newParentId) {
  if (!newParentId) return null;

  const parent = wbsRepository.findById(newParentId);

  if (!parent) {
    throw new AppError('Parent WBS not found', 404);
  }

  if (parent.project_id !== projectId) {
    throw new AppError('Parent project mismatch', 400);
  }

  if (nodeId && parent.id === nodeId) {
    throw new AppError('Invalid parent assignment', 400);
  }

  let cursor = parent;
  while (cursor) {
    if (cursor.id === nodeId) {
      throw new AppError('Invalid parent assignment', 400);
    }

    cursor = cursor.parent_id ? wbsRepository.findById(cursor.parent_id) : null;
  }

  return parent;
}

function assignTemporaryCodes(projectId, nodes) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const tempCode = `__tmp__${projectId}__${String(index + 1).padStart(6, '0')}__${node.id}`;
    wbsRepository.updateCodeAndSort(node.id, tempCode, node.sort_order);
  }
}

function recalculateProjectTree(projectId) {
  const rows = wbsRepository.listByProject(projectId);
  const tree = buildTreeFromRows(rows);
  const flattened = flattenTree(tree);

  wbsRepository.transaction(() => {
    // Phase 1: move all existing codes in the project to unique temporary values
    // so the unique index (project_id, code) never collides during renumbering.
    assignTemporaryCodes(projectId, flattened);

    // Phase 2: write final deterministic codes and sort orders.
    for (const node of flattened) {
      wbsRepository.updateCodeAndSort(node.id, node.code, node.sort_order);
    }
  });

  return tree;
}

function buildCurrentTree(projectId) {
  return buildTreeFromRows(wbsRepository.listByProject(projectId));
}

export const wbsService = {
  listTree(projectId) {
    if (!projectId) {
      throw new AppError('projectId is required', 400);
    }

    ensureProjectExists(projectId);
    return buildCurrentTree(projectId);
  },

  createNode(payload) {
    const projectId = String(payload?.project_id || '').trim();
    const parentId = payload?.parent_id ?? null;
    const name = String(payload?.name || '').trim();

    if (!projectId) {
      throw new AppError('project_id is required', 400);
    }

    if (!name) {
      throw new AppError('WBS name is required', 400);
    }

    ensureProjectExists(projectId);
    ensureValidParentAssignment(projectId, null, parentId);

    const node = {
      id: uuidv4(),
      project_id: projectId,
      parent_id: parentId,
      name,
      code: '__pending__',
      sort_order: wbsRepository.getMaxSortOrder(projectId, parentId) + 1,
    };

    wbsRepository.transaction(() => {
      wbsRepository.create(node);
      recalculateProjectTree(projectId);
    });

    return wbsRepository.findById(node.id);
  },

  updateNode(nodeId, payload) {
    const existing = ensureNodeExists(nodeId);
    const name = String(payload?.name ?? existing.name).trim();
    const parentId = Object.prototype.hasOwnProperty.call(payload || {}, 'parent_id')
      ? payload.parent_id ?? null
      : existing.parent_id;

    if (!name) {
      throw new AppError('WBS name is required', 400);
    }

    ensureValidParentAssignment(existing.project_id, existing.id, parentId);

    const nextSortOrder =
      parentId === existing.parent_id
        ? existing.sort_order
        : wbsRepository.getMaxSortOrder(existing.project_id, parentId) + 1;

    wbsRepository.transaction(() => {
      wbsRepository.update(existing.id, {
        name,
        parent_id: parentId,
        code: existing.code,
        sort_order: nextSortOrder,
      });

      recalculateProjectTree(existing.project_id);
    });

    return wbsRepository.findById(existing.id);
  },

  indentNode(nodeId) {
    const node = ensureNodeExists(nodeId);
    const siblings = wbsRepository.listChildren(node.project_id, node.parent_id);
    const currentIndex = siblings.findIndex((item) => item.id === node.id);

    if (currentIndex <= 0) {
      throw new AppError('No previous sibling to indent under', 400);
    }

    const previousSibling = siblings[currentIndex - 1];

    wbsRepository.transaction(() => {
      wbsRepository.updateHierarchy(
        node.id,
        previousSibling.id,
        wbsRepository.getMaxSortOrder(node.project_id, previousSibling.id) + 1
      );

      recalculateProjectTree(node.project_id);
    });

    return wbsRepository.findById(node.id);
  },

  outdentNode(nodeId) {
    const node = ensureNodeExists(nodeId);

    if (!node.parent_id) {
      throw new AppError('Node is already at root level', 400);
    }

    const parent = ensureNodeExists(node.parent_id);
    const newParentId = parent.parent_id ?? null;
    const insertionSortOrder = parent.sort_order + 1;

    wbsRepository.transaction(() => {
      wbsRepository.incrementSortOrdersFrom(
        node.project_id,
        newParentId,
        insertionSortOrder
      );

      wbsRepository.updateHierarchy(node.id, newParentId, insertionSortOrder);
      recalculateProjectTree(node.project_id);
    });

    return wbsRepository.findById(node.id);
  },

  moveNode(nodeId, direction) {
    const node = ensureNodeExists(nodeId);
    const siblings = wbsRepository.listChildren(node.project_id, node.parent_id);
    const currentIndex = siblings.findIndex((item) => item.id === node.id);

    if (currentIndex === -1) {
      throw new AppError('WBS not found', 404);
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= siblings.length) {
      throw new AppError(
        direction === 'up'
          ? 'Node is already at the top of its level'
          : 'Node is already at the bottom of its level',
        400
      );
    }

    const targetNode = siblings[targetIndex];

    wbsRepository.transaction(() => {
      wbsRepository.updateSortOrder(node.id, targetNode.sort_order);
      wbsRepository.updateSortOrder(targetNode.id, node.sort_order);
      recalculateProjectTree(node.project_id);
    });

    return wbsRepository.findById(node.id);
  },

  deleteNode(nodeId) {
    const node = ensureNodeExists(nodeId);

    wbsRepository.transaction(() => {
      wbsRepository.remove(node.id);
      recalculateProjectTree(node.project_id);
    });

    return { id: node.id };
  },

  recalculateProjectTree,
};
