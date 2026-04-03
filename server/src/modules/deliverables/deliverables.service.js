import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { normalizeOptionalDate, isValidDateRange } from '../../utils/date.js';
import { extractActorId } from '../../utils/audit.js';
import { auditRepository } from '../audit/audit.repository.js';
import { catalogsRepository } from '../catalogs/catalogs.repository.js';
import { activitiesRepository } from '../activities/activities.repository.js';
import { deliverablesRepository } from './deliverables.repository.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeOptionalText(value) {
  return String(value || '').trim();
}


function hasOwn(payload, key) {
  return Boolean(payload) && Object.prototype.hasOwnProperty.call(payload, key);
}

function resolveOptionalDate(payload, key, existingValue) {
  if (hasOwn(payload, key)) {
    return normalizeOptionalDate(payload[key]);
  }
  return existingValue ?? null;
}

function ensureDateWindow(startDate, endDate, startLabel, endLabel) {
  if (!isValidDateRange(startDate, endDate)) {
    throw new AppError(`${endLabel} must be greater than or equal to ${startLabel}`, 400);
  }
}

function deliverableAuditSnapshot(deliverable) {
  return {
    id: deliverable.id,
    project_id: deliverable.project_id,
    wbs_id: deliverable.wbs_id,
    activity_id: deliverable.activity_id,
    document_code: deliverable.document_code,
    title: deliverable.title,
    deliverable_type_code: deliverable.deliverable_type_code,
    discipline_code: deliverable.discipline_code,
    priority_code: deliverable.priority_code,
    status_code: deliverable.status_code,
    current_revision_code: deliverable.current_revision_code || null,
    current_response_code: deliverable.current_response_code || null,
    planned_issue_date: deliverable.planned_issue_date || null,
    forecast_issue_date: deliverable.forecast_issue_date || null,
    actual_issue_date: deliverable.actual_issue_date || null,
    planned_response_date: deliverable.planned_response_date || null,
    forecast_response_date: deliverable.forecast_response_date || null,
    actual_response_date: deliverable.actual_response_date || null,
  };
}

function revisionAuditSnapshot(revision) {
  return {
    id: revision.id,
    deliverable_id: revision.deliverable_id,
    revision_sequence: revision.revision_sequence,
    revision_code: revision.revision_code,
    issue_purpose_code: revision.issue_purpose_code,
    issue_date: revision.issue_date || null,
    issue_transmittal_no: revision.issue_transmittal_no || '',
    planned_response_date: revision.planned_response_date || null,
    response_date: revision.response_date || null,
    response_code: revision.response_code || null,
    response_transmittal_no: revision.response_transmittal_no || '',
    response_by: revision.response_by || '',
  };
}

async function resolveCatalogCode(catalogKey, value, fallback, executor, label) {
  const trimmed = normalizeText(value);
  if (!trimmed) return fallback;

  const normalizedCode = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const byCode = await catalogsRepository.findByCode(catalogKey, normalizedCode, executor);
  if (byCode?.is_active) return byCode.code;

  const byName = await catalogsRepository.findByName(catalogKey, trimmed, executor);
  if (byName?.is_active) return byName.code;

  const allowed = await catalogsRepository.listItems(catalogKey, { includeInactive: false }, executor);
  throw new AppError(`Invalid ${label}`, 400, {
    allowed_values: allowed.map((item) => ({ code: item.code, name: item.name })),
  });
}

async function ensureDeliverableExists(id, executor) {
  const existing = await deliverablesRepository.findById(id, executor);
  if (!existing || !existing.is_active) {
    throw new AppError('Deliverable not found', 404);
  }
  return existing;
}

async function ensureUniqueDocumentCode(documentCode, excludedId, executor) {
  const duplicate = await deliverablesRepository.findByDocumentCode(documentCode, excludedId, executor);
  if (duplicate) {
    throw new AppError('Document code must be unique', 409);
  }
}

async function resolveProjectContext(payload, existing, executor) {
  let projectId = normalizeText(payload?.project_id ?? existing?.project_id);
  let wbsId = normalizeText(payload?.wbs_id ?? existing?.wbs_id);
  let activityId = normalizeText(payload?.activity_id ?? existing?.activity_id);

  let wbs = null;
  if (wbsId) {
    wbs = await activitiesRepository.findWbsById(wbsId, executor);
    if (!wbs) {
      throw new AppError('WBS not found', 404);
    }
    projectId = wbs.project_id;
  }

  let activity = null;
  if (activityId) {
    activity = await activitiesRepository.findById(activityId, executor);
    if (!activity) {
      throw new AppError('Activity not found', 404);
    }
    projectId = activity.project_id;
    if (!wbsId) {
      wbsId = activity.wbs_id;
      wbs = await activitiesRepository.findWbsById(wbsId, executor);
    }
  }

  if (!projectId) {
    throw new AppError('Project is required', 400);
  }

  if (wbs && wbs.project_id !== projectId) {
    throw new AppError('WBS does not belong to the selected project', 400);
  }

  if (activity && activity.project_id !== projectId) {
    throw new AppError('Activity does not belong to the selected project', 400);
  }

  if (activity && wbsId && activity.wbs_id !== wbsId) {
    throw new AppError('Activity does not belong to the selected WBS', 400);
  }

  return {
    project_id: projectId,
    wbs_id: wbsId || null,
    activity_id: activityId || null,
  };
}

function deriveStatusFromRevision(revision) {
  if (!revision) return 'draft';

  const responseCode = normalizeText(revision.response_code).toLowerCase();
  if (['approved', 'approved_with_comments', 'for_information', 'no_response_required'].includes(responseCode)) {
    return 'closed';
  }

  if (['revise_and_resubmit', 'rejected'].includes(responseCode)) {
    return 'returned_for_update';
  }

  if (revision.response_date) {
    return 'responded';
  }

  if (revision.issue_date) {
    return 'under_review';
  }

  return 'issued';
}

async function buildNormalizedDeliverable(payload, existing, actorId, executor) {
  const documentCode = normalizeText(payload?.document_code ?? existing?.document_code);
  const title = normalizeText(payload?.title ?? existing?.title);

  if (!documentCode) {
    throw new AppError('Document code is required', 400);
  }

  if (!title) {
    throw new AppError('Deliverable title is required', 400);
  }

  const projectContext = await resolveProjectContext(payload, existing, executor);

  const deliverable_type_code = await resolveCatalogCode(
    'deliverable-types',
    payload?.deliverable_type_code ?? existing?.deliverable_type_code,
    'drawing',
    executor,
    'deliverable type',
  );

  const discipline_code = await resolveCatalogCode(
    'disciplines',
    payload?.discipline_code ?? existing?.discipline_code,
    'general',
    executor,
    'discipline',
  );

  const priority_code = await resolveCatalogCode(
    'project-priorities',
    payload?.priority_code ?? existing?.priority_code,
    'medium',
    executor,
    'priority',
  );

  const status_code = await resolveCatalogCode(
    'deliverable-statuses',
    payload?.status_code ?? existing?.status_code,
    existing?.status_code || 'draft',
    executor,
    'deliverable status',
  );

  const current_response_code = normalizeText(payload?.current_response_code ?? existing?.current_response_code);
  const resolvedResponseCode = current_response_code
    ? await resolveCatalogCode('document-response-codes', current_response_code, null, executor, 'response code')
    : null;

  const normalized = {
    ...projectContext,
    document_code: documentCode,
    title,
    description: normalizeOptionalText(payload?.description ?? existing?.description),
    deliverable_type_code,
    discipline_code,
    priority_code,
    status_code,
    originator: normalizeOptionalText(payload?.originator ?? existing?.originator),
    responsible_person: normalizeOptionalText(payload?.responsible_person ?? existing?.responsible_person),
    spec_section: normalizeOptionalText(payload?.spec_section ?? existing?.spec_section),
    package_no: normalizeOptionalText(payload?.package_no ?? existing?.package_no),
    planned_issue_date: resolveOptionalDate(payload, 'planned_issue_date', existing?.planned_issue_date),
    forecast_issue_date: resolveOptionalDate(payload, 'forecast_issue_date', existing?.forecast_issue_date),
    actual_issue_date: resolveOptionalDate(payload, 'actual_issue_date', existing?.actual_issue_date),
    planned_response_date: resolveOptionalDate(payload, 'planned_response_date', existing?.planned_response_date),
    forecast_response_date: resolveOptionalDate(payload, 'forecast_response_date', existing?.forecast_response_date),
    actual_response_date: resolveOptionalDate(payload, 'actual_response_date', existing?.actual_response_date),
    current_revision_code: normalizeOptionalText(payload?.current_revision_code ?? existing?.current_revision_code),
    current_response_code: resolvedResponseCode,
    current_issue_transmittal_no: normalizeOptionalText(
      payload?.current_issue_transmittal_no ?? existing?.current_issue_transmittal_no,
    ),
    current_response_transmittal_no: normalizeOptionalText(
      payload?.current_response_transmittal_no ?? existing?.current_response_transmittal_no,
    ),
    remarks: normalizeOptionalText(payload?.remarks ?? existing?.remarks),
    is_active: existing?.is_active ?? true,
    created_by: existing?.created_by || actorId || null,
    updated_by: actorId || existing?.updated_by || null,
  };

  ensureDateWindow(normalized.planned_issue_date, normalized.actual_issue_date, 'planned issue date', 'actual issue date');
  ensureDateWindow(
    normalized.planned_response_date,
    normalized.actual_response_date,
    'planned response date',
    'actual response date',
  );

  return normalized;
}

async function buildNormalizedRevision(deliverableId, payload, existing, actorId, executor) {
  const revisionCode = normalizeText(payload?.revision_code ?? existing?.revision_code);
  if (!revisionCode) {
    throw new AppError('Revision code is required', 400);
  }

  const issue_purpose_code = await resolveCatalogCode(
    'revision-purposes',
    payload?.issue_purpose_code ?? existing?.issue_purpose_code,
    'ifa',
    executor,
    'revision purpose',
  );

  const responseCodeRaw = normalizeText(payload?.response_code ?? existing?.response_code);
  const response_code = responseCodeRaw
    ? await resolveCatalogCode('document-response-codes', responseCodeRaw, null, executor, 'response code')
    : null;

  const issue_date = resolveOptionalDate(payload, 'issue_date', existing?.issue_date);
  const planned_response_date = resolveOptionalDate(payload, 'planned_response_date', existing?.planned_response_date);
  const response_date = resolveOptionalDate(payload, 'response_date', existing?.response_date);

  ensureDateWindow(issue_date, planned_response_date, 'issue date', 'planned response date');
  ensureDateWindow(issue_date, response_date, 'issue date', 'response date');

  const revisionSequence = existing?.revision_sequence || (await deliverablesRepository.getNextRevisionSequence(deliverableId, executor));

  return {
    deliverable_id: deliverableId,
    revision_sequence: revisionSequence,
    revision_code: revisionCode,
    issue_purpose_code,
    issue_date,
    issue_transmittal_no: normalizeOptionalText(payload?.issue_transmittal_no ?? existing?.issue_transmittal_no),
    planned_response_date,
    response_date,
    response_code,
    response_transmittal_no: normalizeOptionalText(
      payload?.response_transmittal_no ?? existing?.response_transmittal_no,
    ),
    response_by: normalizeOptionalText(payload?.response_by ?? existing?.response_by),
    remarks: normalizeOptionalText(payload?.remarks ?? existing?.remarks),
    created_by: existing?.created_by || actorId || null,
    updated_by: actorId || existing?.updated_by || null,
  };
}

async function synchronizeDeliverableCurrentState(deliverableId, actorId, executor) {
  const deliverable = await deliverablesRepository.findById(deliverableId, executor);
  if (!deliverable) return null;

  const revisions = await deliverablesRepository.listRevisions(deliverableId, executor);
  const latestRevision = revisions[0] || null;

  const nextState = {
    ...deliverable,
    status_code: deriveStatusFromRevision(latestRevision),
    current_revision_code: latestRevision?.revision_code || '',
    current_response_code: latestRevision?.response_code || null,
    current_issue_transmittal_no: latestRevision?.issue_transmittal_no || '',
    current_response_transmittal_no: latestRevision?.response_transmittal_no || '',
    actual_issue_date: latestRevision?.issue_date || null,
    planned_response_date: latestRevision?.planned_response_date || deliverable.planned_response_date || null,
    actual_response_date: latestRevision?.response_date || null,
    updated_by: actorId || deliverable.updated_by || null,
  };

  return deliverablesRepository.update(deliverableId, nextState, executor);
}

export const deliverablesService = {
  async listDeliverables(projectId, filters = {}) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }

    return deliverablesRepository.listByProject(normalizedProjectId, filters);
  },

  async getDeliverableDetail(deliverableId) {
    const normalizedId = normalizeText(deliverableId);
    if (!normalizedId) {
      throw new AppError('Deliverable ID is required', 400);
    }

    const deliverable = await ensureDeliverableExists(normalizedId);
    const revisions = await deliverablesRepository.listRevisions(normalizedId);

    return {
      deliverable,
      revisions,
    };
  },

  async createDeliverable(payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const normalized = await buildNormalizedDeliverable(payload, null, actorId, client);
      await ensureUniqueDocumentCode(normalized.document_code, null, client);

      const created = await deliverablesRepository.create(normalized, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'deliverable',
          entity_id: created.id,
          project_id: created.project_id,
          action: 'create',
          summary: `Deliverable created: ${created.document_code}`,
          before_data: null,
          after_data: deliverableAuditSnapshot(created),
          metadata: { document_code: created.document_code },
          ...requestContext,
        },
        client,
      );

      return created;
    });
  },

  async updateDeliverable(id, payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureDeliverableExists(id, client);
      const normalized = await buildNormalizedDeliverable(payload, existing, actorId, client);
      await ensureUniqueDocumentCode(normalized.document_code, existing.id, client);

      const updated = await deliverablesRepository.update(id, normalized, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'deliverable',
          entity_id: updated.id,
          project_id: updated.project_id,
          action: 'update',
          summary: `Deliverable updated: ${updated.document_code}`,
          before_data: deliverableAuditSnapshot(existing),
          after_data: deliverableAuditSnapshot(updated),
          metadata: { document_code: updated.document_code },
          ...requestContext,
        },
        client,
      );

      return updated;
    });
  },

  async deleteDeliverable(id, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureDeliverableExists(id, client);
      const removed = await deliverablesRepository.deactivate(id, actorId, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'deliverable',
          entity_id: existing.id,
          project_id: existing.project_id,
          action: 'delete',
          summary: `Deliverable deactivated: ${existing.document_code}`,
          before_data: deliverableAuditSnapshot(existing),
          after_data: deliverableAuditSnapshot(removed),
          metadata: { document_code: existing.document_code },
          ...requestContext,
        },
        client,
      );

      return { id };
    });
  },

  async createRevision(deliverableId, payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const deliverable = await ensureDeliverableExists(deliverableId, client);
      const normalizedRevision = await buildNormalizedRevision(deliverable.id, payload, null, actorId, client);
      const created = await deliverablesRepository.createRevision(normalizedRevision, client);
      const deliverableAfterSync = await synchronizeDeliverableCurrentState(deliverable.id, actorId, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'deliverable.revision',
          entity_id: created.id,
          project_id: deliverable.project_id,
          action: 'create',
          summary: `Revision created for ${deliverable.document_code}: ${created.revision_code}`,
          before_data: null,
          after_data: revisionAuditSnapshot(created),
          metadata: {
            deliverable_id: deliverable.id,
            document_code: deliverable.document_code,
            deliverable_status_code: deliverableAfterSync?.status_code || null,
          },
          ...requestContext,
        },
        client,
      );

      return {
        revision: created,
        deliverable: deliverableAfterSync,
      };
    });
  },

  async updateRevision(deliverableId, revisionId, payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const deliverable = await ensureDeliverableExists(deliverableId, client);
      const existingRevision = await deliverablesRepository.findRevisionById(deliverable.id, revisionId, client);

      if (!existingRevision) {
        throw new AppError('Revision not found', 404);
      }

      const normalizedRevision = await buildNormalizedRevision(deliverable.id, payload, existingRevision, actorId, client);
      const updatedRevision = await deliverablesRepository.updateRevision(
        deliverable.id,
        revisionId,
        normalizedRevision,
        client,
      );
      const deliverableAfterSync = await synchronizeDeliverableCurrentState(deliverable.id, actorId, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'deliverable.revision',
          entity_id: updatedRevision.id,
          project_id: deliverable.project_id,
          action: 'update',
          summary: `Revision updated for ${deliverable.document_code}: ${updatedRevision.revision_code}`,
          before_data: revisionAuditSnapshot(existingRevision),
          after_data: revisionAuditSnapshot(updatedRevision),
          metadata: {
            deliverable_id: deliverable.id,
            document_code: deliverable.document_code,
            deliverable_status_code: deliverableAfterSync?.status_code || null,
          },
          ...requestContext,
        },
        client,
      );

      return {
        revision: updatedRevision,
        deliverable: deliverableAfterSync,
      };
    });
  },
};
