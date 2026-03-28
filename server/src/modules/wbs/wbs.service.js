import { AppError } from '../../errors/AppError.js';
import { wbsRepository } from './wbs.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { extractActorId } from '../../utils/audit.js';

function normalizeRequiredText(value, fieldLabel) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new AppError(`${fieldLabel} is required`, 400);
  }

  return normalized;
}

function normalizeOptionalId(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  return normalized || null;
}

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

function wbsAuditSnapshot(node) {
  return {
    id: node.id,
    project_id: node.project_id,
    parent_id: node.parent_id,
    name: node.name,
    code: node.code,
    sort_order: Number(node.sort_order || 0),
  };
}

async function ensureProjectExists(projectId, executor) {
  const project = await wbsRepository.findProjectById(projectId, executor);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  return project;
}

async function ensureNodeExists(nodeId, executor) {
  const node = await wbsRepository.findById(nodeId, executor);

  if (!node) {
    throw new AppError('WBS not found', 404);
  }

  return node;
}

async function ensureValidParentAssignment(projectId, nodeId, newParentId, executor) {
  if (!newParentId) return null;

  const parent = await wbsRepository.findById(newParentId, executor);

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

    cursor = cursor.parent_id
      ? await wbsRepository.findById(cursor.parent_id, executor)
      : null;
  }

  return parent;
}

async function assignTemporaryCodesAndSortOrders(projectId, nodes, actorId, executor) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const tempCode = `__tmp__${projectId}__${String(index + 1).padStart(6, '0')}__${node.id}`;
    const tempSortOrder = 1000000 + index + 1;
    await wbsRepository.updateCodeAndSort(node.id, tempCode, tempSortOrder, actorId, executor);
  }
}

async function recalculateProjectTreeInternal(projectId, actorId, executor) {
  const rows = await wbsRepository.listByProject(projectId, executor);
  const tree = buildTreeFromRows(rows);
  const flattened = flattenTree(tree);

  await assignTemporaryCodesAndSortOrders(projectId, flattened, actorId, executor);

  for (const node of flattened) {
    await wbsRepository.updateCodeAndSort(node.id, node.code, node.sort_order, actorId, executor);
  }

  return tree;
}

async function buildCurrentTree(projectId, executor) {
  return buildTreeFromRows(await wbsRepository.listByProject(projectId, executor));
}

export const wbsService = {
  async listTree(projectId) {
    const normalizedProjectId = normalizeRequiredText(projectId, 'projectId');
    await ensureProjectExists(normalizedProjectId);
    return buildCurrentTree(normalizedProjectId);
  },

  async createNode(payload, actor, requestContext = {}) {
    const projectId = normalizeRequiredText(payload?.project_id, 'project_id');
    const parentId = normalizeOptionalId(payload?.parent_id);
    const name = normalizeRequiredText(payload?.name, 'WBS name');
    const actorId = extractActorId(actor);

    return wbsRepository.transaction(async (client) => {
      await ensureProjectExists(projectId, client);
      await ensureValidParentAssignment(projectId, null, parentId, client);

      const node = await wbsRepository.create(
        {
          project_id: projectId,
          parent_id: parentId,
          name,
          code: '__pending__',
          sort_order: (await wbsRepository.getMaxSortOrder(projectId, parentId, client)) + 1,
          created_by: actorId,
          updated_by: actorId,
        },
        client
      );

      await recalculateProjectTreeInternal(projectId, actorId, client);
      const created = await wbsRepository.findById(node.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'wbs_node',
          entity_id: created.id,
          project_id: created.project_id,
          action: 'create',
          summary: `WBS node created: ${created.code} ${created.name}`,
          before_data: null,
          after_data: wbsAuditSnapshot(created),
          ...requestContext,
        },
        client
      );

      return created;
    });
  },

  async updateNode(nodeId, payload, actor, requestContext = {}) {
    const normalizedNodeId = normalizeRequiredText(nodeId, 'id');
    const actorId = extractActorId(actor);

    return wbsRepository.transaction(async (client) => {
      const existing = await ensureNodeExists(normalizedNodeId, client);
      const beforeSnapshot = wbsAuditSnapshot(existing);
      const name = normalizeRequiredText(payload?.name ?? existing.name, 'WBS name');
      const parentId = Object.prototype.hasOwnProperty.call(payload || {}, 'parent_id')
        ? normalizeOptionalId(payload.parent_id)
        : existing.parent_id;

      await ensureValidParentAssignment(existing.project_id, existing.id, parentId, client);

      const nextSortOrder =
        parentId === existing.parent_id
          ? existing.sort_order
          : (await wbsRepository.getMaxSortOrder(existing.project_id, parentId, client)) + 1;

      await wbsRepository.update(
        existing.id,
        {
          name,
          parent_id: parentId,
          code: existing.code,
          sort_order: nextSortOrder,
          updated_by: actorId,
        },
        client
      );

      await recalculateProjectTreeInternal(existing.project_id, actorId, client);
      const updated = await wbsRepository.findById(existing.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'wbs_node',
          entity_id: updated.id,
          project_id: updated.project_id,
          action: 'update',
          summary: `WBS node updated: ${updated.code} ${updated.name}`,
          before_data: beforeSnapshot,
          after_data: wbsAuditSnapshot(updated),
          ...requestContext,
        },
        client
      );

      return updated;
    });
  },

  async indentNode(nodeId, actor, requestContext = {}) {
    const normalizedNodeId = normalizeRequiredText(nodeId, 'id');
    const actorId = extractActorId(actor);

    return wbsRepository.transaction(async (client) => {
      const node = await ensureNodeExists(normalizedNodeId, client);
      const beforeSnapshot = wbsAuditSnapshot(node);
      const siblings = await wbsRepository.listChildren(node.project_id, node.parent_id, client);
      const currentIndex = siblings.findIndex((item) => item.id === node.id);

      if (currentIndex <= 0) {
        throw new AppError('No previous sibling to indent under', 400);
      }

      const previousSibling = siblings[currentIndex - 1];

      await wbsRepository.updateHierarchy(
        node.id,
        previousSibling.id,
        (await wbsRepository.getMaxSortOrder(node.project_id, previousSibling.id, client)) + 1,
        actorId,
        client
      );

      await recalculateProjectTreeInternal(node.project_id, actorId, client);
      const updated = await wbsRepository.findById(node.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'wbs_node',
          entity_id: updated.id,
          project_id: updated.project_id,
          action: 'move',
          summary: `WBS node indented under previous sibling: ${updated.code} ${updated.name}`,
          before_data: beforeSnapshot,
          after_data: wbsAuditSnapshot(updated),
          metadata: { operation: 'indent' },
          ...requestContext,
        },
        client
      );

      return updated;
    });
  },

  async outdentNode(nodeId, actor, requestContext = {}) {
    const normalizedNodeId = normalizeRequiredText(nodeId, 'id');
    const actorId = extractActorId(actor);

    return wbsRepository.transaction(async (client) => {
      const node = await ensureNodeExists(normalizedNodeId, client);
      const beforeSnapshot = wbsAuditSnapshot(node);

      if (!node.parent_id) {
        throw new AppError('Node is already at root level', 400);
      }

      const parent = await ensureNodeExists(node.parent_id, client);
      const newParentId = parent.parent_id ?? null;
      const insertionSortOrder = parent.sort_order + 1;

      await wbsRepository.incrementSortOrdersFrom(
        node.project_id,
        newParentId,
        insertionSortOrder,
        actorId,
        client
      );

      await wbsRepository.updateHierarchy(node.id, newParentId, insertionSortOrder, actorId, client);
      await recalculateProjectTreeInternal(node.project_id, actorId, client);
      const updated = await wbsRepository.findById(node.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'wbs_node',
          entity_id: updated.id,
          project_id: updated.project_id,
          action: 'move',
          summary: `WBS node outdented: ${updated.code} ${updated.name}`,
          before_data: beforeSnapshot,
          after_data: wbsAuditSnapshot(updated),
          metadata: { operation: 'outdent' },
          ...requestContext,
        },
        client
      );

      return updated;
    });
  },

  async moveNode(nodeId, direction, actor, requestContext = {}) {
    const normalizedNodeId = normalizeRequiredText(nodeId, 'id');

    if (!['up', 'down'].includes(direction)) {
      throw new AppError('Invalid movement direction', 400);
    }

    const actorId = extractActorId(actor);

    return wbsRepository.transaction(async (client) => {
      const node = await ensureNodeExists(normalizedNodeId, client);
      const beforeSnapshot = wbsAuditSnapshot(node);
      const siblings = await wbsRepository.listChildren(node.project_id, node.parent_id, client);
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

      await wbsRepository.updateSortOrder(node.id, targetNode.sort_order, actorId, client);
      await wbsRepository.updateSortOrder(targetNode.id, node.sort_order, actorId, client);
      await recalculateProjectTreeInternal(node.project_id, actorId, client);
      const updated = await wbsRepository.findById(node.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'wbs_node',
          entity_id: updated.id,
          project_id: updated.project_id,
          action: 'move',
          summary: `WBS node moved ${direction}: ${updated.code} ${updated.name}`,
          before_data: beforeSnapshot,
          after_data: wbsAuditSnapshot(updated),
          metadata: { direction },
          ...requestContext,
        },
        client
      );

      return updated;
    });
  },

  async deleteNode(nodeId, actor, requestContext = {}) {
    const normalizedNodeId = normalizeRequiredText(nodeId, 'id');
    const actorId = extractActorId(actor);

    return wbsRepository.transaction(async (client) => {
      const node = await ensureNodeExists(normalizedNodeId, client);
      const beforeSnapshot = wbsAuditSnapshot(node);
      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'wbs_node',
          entity_id: node.id,
          project_id: node.project_id,
          action: 'delete',
          summary: `WBS node deleted: ${node.code} ${node.name}`,
          before_data: beforeSnapshot,
          after_data: null,
          ...requestContext,
        },
        client
      );
      await wbsRepository.remove(node.id, client);
      await recalculateProjectTreeInternal(node.project_id, actorId, client);
      return { id: node.id };
    });
  },

  async recalculateProjectTree(projectId) {
    const normalizedProjectId = normalizeRequiredText(projectId, 'projectId');

    return wbsRepository.transaction(async (client) => {
      await ensureProjectExists(normalizedProjectId, client);
      await recalculateProjectTreeInternal(normalizedProjectId, null, client);
      return buildCurrentTree(normalizedProjectId, client);
    });
  },
};
