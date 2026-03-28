import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { computeDuration, isValidDateRange, normalizeOptionalDate } from '../../utils/date.js';
import { activitiesRepository } from './activities.repository.js';
import { catalogsRepository } from '../catalogs/catalogs.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { extractActorId } from '../../utils/audit.js';

const LEGACY_STATUS_CODE_MAP = {
  'not started': 'not_started',
  not_started: 'not_started',
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  completed: 'completed',
  'on hold': 'on_hold',
  on_hold: 'on_hold',
};

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeOptionalText(value) {
  return String(value || '').trim();
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function activityAuditSnapshot(activity) {
  return {
    id: activity.id,
    project_id: activity.project_id,
    wbs_id: activity.wbs_id,
    activity_id: activity.activity_id,
    name: activity.name,
    start_date: activity.start_date || null,
    end_date: activity.end_date || null,
    duration: Number(activity.duration || 0),
    progress: Number(activity.progress || 0),
    budget_hours: Number(activity.budget_hours ?? activity.hours ?? 0),
    budget_cost: Number(activity.budget_cost ?? activity.cost ?? 0),
    actual_hours: Number(activity.actual_hours || 0),
    actual_cost: Number(activity.actual_cost || 0),
    remaining_hours: Number(activity.remaining_hours || 0),
    remaining_cost: Number(activity.remaining_cost || 0),
    latest_progress_date: activity.latest_progress_date || null,
    latest_actual_date: activity.latest_actual_date || null,
    status_code: activity.status_code,
    status_name: activity.status_name || activity.status,
    activity_type_code: activity.activity_type_code,
    activity_type_name: activity.activity_type_name || null,
    priority_code: activity.priority_code,
    priority_name: activity.priority_name || null,
    sort_order: Number(activity.sort_order || 0),
    notes: activity.notes || '',
  };
}

async function buildDefaultActivityId(projectId, executor) {
  const rows = await activitiesRepository.listActivityIdsByProject(projectId, executor);
  const maxNumericSuffix = rows.reduce((maxValue, row) => {
    const value = String(row.activity_id || '').trim();
    const match = value.match(/(\d+)$/);

    if (!match) return maxValue;

    const numericValue = Number(match[1]);
    return Number.isFinite(numericValue) ? Math.max(maxValue, numericValue) : maxValue;
  }, 0);

  return `ACT-${String(maxNumericSuffix + 1).padStart(3, '0')}`;
}

async function resolveCatalogCode(catalogKey, value, fallback, executor, options = {}) {
  const { legacyStatusMap = null, label = catalogKey } = options;
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return fallback;
  }

  const normalizedCode = normalizeText(trimmed).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const candidateCode = legacyStatusMap?.[trimmed.toLowerCase()] || legacyStatusMap?.[normalizedCode] || normalizedCode;

  const byCode = await catalogsRepository.findByCode(catalogKey, candidateCode, executor);
  if (byCode?.is_active) {
    return byCode.code;
  }

  const byName = await catalogsRepository.findByName(catalogKey, trimmed, executor);
  if (byName?.is_active) {
    return byName.code;
  }

  const allowed = await catalogsRepository.listItems(catalogKey, { includeInactive: false }, executor);
  throw new AppError(`Invalid ${label}`, 400, {
    allowed_values: allowed.map((item) => ({ code: item.code, name: item.name })),
  });
}

function ensureValidActivityPayload(payload) {
  if (!payload.activity_id) {
    throw new AppError('Activity ID is required', 400);
  }

  if (!payload.name) {
    throw new AppError('Activity name is required', 400);
  }

  if (payload.progress < 0 || payload.progress > 100) {
    throw new AppError('Progress must be between 0 and 100', 400);
  }

  if (payload.hours < 0 || payload.cost < 0) {
    throw new AppError('Hours and cost must be >= 0', 400);
  }

  if (!isValidDateRange(payload.start_date, payload.end_date)) {
    throw new AppError('End date must be greater than or equal to start date', 400);
  }
}

async function ensureActivityExists(activityId, executor) {
  const existing = await activitiesRepository.findById(activityId, executor);

  if (!existing) {
    throw new AppError('Activity not found', 404);
  }

  return existing;
}

async function ensureWbsExists(wbsId, executor) {
  const wbs = await activitiesRepository.findWbsById(wbsId, executor);

  if (!wbs) {
    throw new AppError('WBS not found', 404);
  }

  return wbs;
}

async function ensureUniqueActivityId(projectId, activityId, excludedId, executor) {
  const duplicate = await activitiesRepository.findByProjectAndActivityId(
    projectId,
    activityId,
    excludedId,
    executor
  );

  if (duplicate) {
    throw new AppError('Activity ID must be unique within the project', 409);
  }
}

async function applySiblingOrder(siblings, executor, actorId) {
  for (let index = 0; index < siblings.length; index += 1) {
    await activitiesRepository.updateSortOrder(siblings[index].id, 1000000 + index + 1, actorId, executor);
  }

  for (let index = 0; index < siblings.length; index += 1) {
    await activitiesRepository.updateSortOrder(siblings[index].id, index + 1, actorId, executor);
  }
}

async function resequenceWbsActivities(wbsId, executor, actorId) {
  const siblings = await activitiesRepository.listSiblings(wbsId, executor);
  await applySiblingOrder(siblings, executor, actorId);
}

async function buildNormalizedActivity(payload, existing, wbs, actorId, executor) {
  const startDate = Object.prototype.hasOwnProperty.call(payload || {}, 'start_date')
    ? normalizeOptionalDate(payload.start_date)
    : existing?.start_date || null;

  const endDate = Object.prototype.hasOwnProperty.call(payload || {}, 'end_date')
    ? normalizeOptionalDate(payload.end_date)
    : existing?.end_date || null;

  const status_code = await resolveCatalogCode(
    'activity-statuses',
    payload?.status_code ?? payload?.status ?? existing?.status_code ?? existing?.status,
    'not_started',
    executor,
    { legacyStatusMap: LEGACY_STATUS_CODE_MAP, label: 'activity status' }
  );

  const activity_type_code = await resolveCatalogCode(
    'activity-types',
    payload?.activity_type_code ?? payload?.activity_type ?? existing?.activity_type_code,
    'task',
    executor,
    { label: 'activity type' }
  );

  const priority_code = await resolveCatalogCode(
    'activity-priorities',
    payload?.priority_code ?? payload?.priority ?? existing?.priority_code,
    'medium',
    executor,
    { label: 'activity priority' }
  );

  const normalized = {
    project_id: wbs.project_id,
    wbs_id: wbs.id,
    activity_id: normalizeText(payload?.activity_id ?? existing?.activity_id),
    name: normalizeText(payload?.name ?? existing?.name),
    start_date: startDate,
    end_date: endDate,
    progress: normalizeNumber(payload?.progress ?? existing?.progress, existing?.progress ?? 0),
    hours: normalizeNumber(
      payload?.budget_hours ?? payload?.hours ?? existing?.budget_hours ?? existing?.hours,
      existing?.budget_hours ?? existing?.hours ?? 0
    ),
    cost: normalizeNumber(
      payload?.budget_cost ?? payload?.cost ?? existing?.budget_cost ?? existing?.cost,
      existing?.budget_cost ?? existing?.cost ?? 0
    ),
    status_code,
    activity_type_code,
    priority_code,
    notes: Object.prototype.hasOwnProperty.call(payload || {}, 'notes')
      ? normalizeOptionalText(payload?.notes)
      : normalizeOptionalText(existing?.notes),
    sort_order: existing?.sort_order ?? 0,
    created_by: existing?.created_by || actorId || null,
    updated_by: actorId || existing?.updated_by || null,
  };

  normalized.duration =
    normalized.start_date && normalized.end_date
      ? computeDuration(normalized.start_date, normalized.end_date)
      : Math.max(0, normalizeNumber(payload?.duration ?? existing?.duration, existing?.duration ?? 0));

  return normalized;
}

function deriveStatusCodeFromProgress(progress) {
  const normalizedProgress = normalizeNumber(progress, 0);
  if (normalizedProgress >= 100) return 'completed';
  if (normalizedProgress <= 0) return 'not_started';
  return 'in_progress';
}

function normalizeRequiredDate(value, fallback = getTodayDate()) {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return fallback;
  }

  const normalized = normalizeOptionalDate(trimmed);
  if (!normalized) {
    throw new AppError('Invalid date', 400);
  }

  return normalized;
}

function normalizeProgressValue(value, fallback) {
  const parsed = normalizeNumber(value, fallback);
  if (parsed < 0 || parsed > 100) {
    throw new AppError('Progress must be between 0 and 100', 400);
  }
  return parsed;
}

function normalizeNonNegative(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(`${label} must be greater than or equal to 0`, 400);
  }
  return parsed;
}

function buildControlSummary(activity) {
  return {
    budget_hours: Number(activity.budget_hours ?? activity.hours ?? 0),
    budget_cost: Number(activity.budget_cost ?? activity.cost ?? 0),
    actual_hours: Number(activity.actual_hours ?? 0),
    actual_cost: Number(activity.actual_cost ?? 0),
    remaining_hours: Number(activity.remaining_hours ?? 0),
    remaining_cost: Number(activity.remaining_cost ?? 0),
    current_progress: Number(activity.progress ?? 0),
    latest_progress_date: activity.latest_progress_date || null,
    latest_actual_date: activity.latest_actual_date || null,
    progress_update_count: Number(activity.progress_update_count ?? 0),
    actual_entry_count: Number(activity.actual_entry_count ?? 0),
  };
}

export const activitiesService = {
  async listActivities(projectId) {
    const normalizedProjectId = normalizeText(projectId);

    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }

    return activitiesRepository.listByProject(normalizedProjectId);
  },

  async getActivityControlData(activityId) {
    const normalizedActivityId = normalizeText(activityId);

    if (!normalizedActivityId) {
      throw new AppError('Activity ID is required', 400);
    }

    const activity = await ensureActivityExists(normalizedActivityId);
    const [progress_updates, actual_entries] = await Promise.all([
      activitiesRepository.listProgressUpdates(activity.id),
      activitiesRepository.listActualEntries(activity.id),
    ]);

    return {
      activity,
      summary: buildControlSummary(activity),
      progress_updates,
      actual_entries,
    };
  },

  async createActivity(payload, actor, requestContext = {}) {
    const wbsId = normalizeText(payload?.wbs_id);
    const name = normalizeText(payload?.name);
    const actorId = extractActorId(actor);

    if (!wbsId) {
      throw new AppError('wbs_id is required', 400);
    }

    if (!name) {
      throw new AppError('Activity name is required', 400);
    }

    return withTransaction(async (client) => {
      const wbs = await ensureWbsExists(wbsId, client);
      const activityId =
        normalizeText(payload?.activity_id) || (await buildDefaultActivityId(wbs.project_id, client));

      const activity = await buildNormalizedActivity(
        {
          ...payload,
          activity_id: activityId,
          name,
        },
        null,
        wbs,
        actorId,
        client
      );

      activity.sort_order = (await activitiesRepository.getMaxSortOrder(wbsId, client)) + 1;

      ensureValidActivityPayload(activity);
      await ensureUniqueActivityId(activity.project_id, activity.activity_id, null, client);

      const created = await activitiesRepository.create(activity, client);
      await resequenceWbsActivities(wbsId, client, actorId);
      const persisted = await activitiesRepository.findById(created.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'activity',
          entity_id: persisted.id,
          project_id: persisted.project_id,
          action: 'create',
          summary: `Activity created: ${persisted.activity_id} ${persisted.name}`,
          before_data: null,
          after_data: activityAuditSnapshot(persisted),
          ...requestContext,
        },
        client
      );

      return persisted;
    });
  },

  async updateActivity(activityId, payload, actor, requestContext = {}) {
    const normalizedActivityId = normalizeText(activityId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureActivityExists(normalizedActivityId, client);
      const beforeSnapshot = activityAuditSnapshot(existing);

      const targetWbsId = Object.prototype.hasOwnProperty.call(payload || {}, 'wbs_id')
        ? normalizeText(payload.wbs_id)
        : existing.wbs_id;

      if (!targetWbsId) {
        throw new AppError('wbs_id is required', 400);
      }

      const targetWbs = await ensureWbsExists(targetWbsId, client);
      const normalized = await buildNormalizedActivity(payload, existing, targetWbs, actorId, client);

      normalized.sort_order =
        targetWbs.id === existing.wbs_id
          ? existing.sort_order
          : (await activitiesRepository.getMaxSortOrder(targetWbs.id, client)) + 1;

      ensureValidActivityPayload(normalized);
      await ensureUniqueActivityId(normalized.project_id, normalized.activity_id, existing.id, client);

      const updated = await activitiesRepository.update(existing.id, normalized, client);

      await resequenceWbsActivities(updated.wbs_id, client, actorId);
      if (existing.wbs_id !== updated.wbs_id) {
        await resequenceWbsActivities(existing.wbs_id, client, actorId);
      }

      const persisted = await activitiesRepository.findById(existing.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'activity',
          entity_id: persisted.id,
          project_id: persisted.project_id,
          action: 'update',
          summary: `Activity updated: ${persisted.activity_id} ${persisted.name}`,
          before_data: beforeSnapshot,
          after_data: activityAuditSnapshot(persisted),
          ...requestContext,
        },
        client
      );

      return persisted;
    });
  },

  async createProgressUpdate(activityId, payload, actor, requestContext = {}) {
    const normalizedActivityId = normalizeText(activityId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureActivityExists(normalizedActivityId, client);
      const progress = normalizeProgressValue(
        payload?.progress_percent ?? payload?.progress,
        existing.progress ?? 0
      );
      const update_date = normalizeRequiredDate(payload?.update_date);
      const status_code = await resolveCatalogCode(
        'activity-statuses',
        payload?.status_code ?? payload?.status ?? deriveStatusCodeFromProgress(progress),
        deriveStatusCodeFromProgress(progress),
        client,
        { legacyStatusMap: LEGACY_STATUS_CODE_MAP, label: 'activity status' }
      );
      const notes = normalizeOptionalText(payload?.notes);

      const entry = await activitiesRepository.insertProgressUpdate(
        {
          activity_id: existing.id,
          project_id: existing.project_id,
          update_date,
          progress_percent: progress,
          status_code,
          notes,
          created_by: actorId,
          source_type: 'manual',
        },
        client
      );

      await activitiesRepository.updateProgressSummary(
        existing.id,
        {
          progress,
          status_code,
          updated_by: actorId,
        },
        client
      );

      const refreshed = await activitiesRepository.findById(existing.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'activity',
          entity_id: existing.id,
          project_id: existing.project_id,
          action: 'progress_update',
          summary: `Progress update recorded for ${existing.activity_id}: ${progress}%`,
          before_data: { progress: existing.progress, status_code: existing.status_code },
          after_data: {
            progress: refreshed.progress,
            status_code: refreshed.status_code,
            latest_progress_date: refreshed.latest_progress_date,
          },
          metadata: {
            progress_update_id: entry.id,
            update_date: entry.update_date,
          },
          ...requestContext,
        },
        client
      );

      return {
        entry,
        activity: refreshed,
        summary: buildControlSummary(refreshed),
      };
    });
  },

  async createActualEntry(activityId, payload, actor, requestContext = {}) {
    const normalizedActivityId = normalizeText(activityId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureActivityExists(normalizedActivityId, client);
      const actual_date = normalizeRequiredDate(payload?.actual_date);
      const actual_hours = normalizeNonNegative(payload?.actual_hours ?? payload?.hours ?? 0, 'Actual hours');
      const actual_cost = normalizeNonNegative(payload?.actual_cost ?? payload?.cost ?? 0, 'Actual cost');
      const notes = normalizeOptionalText(payload?.notes);

      if (actual_hours <= 0 && actual_cost <= 0) {
        throw new AppError('You must register actual hours or actual cost', 400);
      }

      const entry = await activitiesRepository.insertActualEntry(
        {
          activity_id: existing.id,
          project_id: existing.project_id,
          actual_date,
          actual_hours,
          actual_cost,
          notes,
          created_by: actorId,
          source_type: 'manual',
        },
        client
      );

      await activitiesRepository.touchActivity(existing.id, actorId, client);
      const refreshed = await activitiesRepository.findById(existing.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'activity',
          entity_id: existing.id,
          project_id: existing.project_id,
          action: 'actual_entry',
          summary: `Actual entry recorded for ${existing.activity_id}`,
          before_data: {
            actual_hours: existing.actual_hours,
            actual_cost: existing.actual_cost,
            latest_actual_date: existing.latest_actual_date,
          },
          after_data: {
            actual_hours: refreshed.actual_hours,
            actual_cost: refreshed.actual_cost,
            latest_actual_date: refreshed.latest_actual_date,
          },
          metadata: {
            actual_entry_id: entry.id,
            actual_date: entry.actual_date,
            actual_hours: entry.actual_hours,
            actual_cost: entry.actual_cost,
          },
          ...requestContext,
        },
        client
      );

      return {
        entry,
        activity: refreshed,
        summary: buildControlSummary(refreshed),
      };
    });
  },

  async moveActivity(activityId, direction, actor, requestContext = {}) {
    const normalizedActivityId = normalizeText(activityId);

    if (!['up', 'down'].includes(direction)) {
      throw new AppError('Invalid movement direction', 400);
    }

    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const activity = await ensureActivityExists(normalizedActivityId, client);
      const beforeSnapshot = activityAuditSnapshot(activity);
      const siblings = await activitiesRepository.listSiblings(activity.wbs_id, client);
      const currentIndex = siblings.findIndex((item) => item.id === activity.id);

      if (currentIndex === -1) {
        throw new AppError('Activity not found', 404);
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= siblings.length) {
        throw new AppError(
          direction === 'up'
            ? 'Activity is already at the top of its WBS level'
            : 'Activity is already at the bottom of its WBS level',
          400
        );
      }

      const ordered = [...siblings];
      const [moved] = ordered.splice(currentIndex, 1);
      ordered.splice(targetIndex, 0, moved);

      await applySiblingOrder(ordered, client, actorId);
      const persisted = await activitiesRepository.findById(activity.id, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'activity',
          entity_id: persisted.id,
          project_id: persisted.project_id,
          action: 'move',
          summary: `Activity moved ${direction}: ${persisted.activity_id} ${persisted.name}`,
          before_data: beforeSnapshot,
          after_data: activityAuditSnapshot(persisted),
          metadata: { direction },
          ...requestContext,
        },
        client
      );

      return persisted;
    });
  },

  async deleteActivity(activityId, actor, requestContext = {}) {
    const normalizedActivityId = normalizeText(activityId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureActivityExists(normalizedActivityId, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'activity',
          entity_id: existing.id,
          project_id: existing.project_id,
          action: 'delete',
          summary: `Activity deleted: ${existing.activity_id} ${existing.name}`,
          before_data: activityAuditSnapshot(existing),
          after_data: null,
          ...requestContext,
        },
        client
      );

      await activitiesRepository.remove(existing.id, client);
      await resequenceWbsActivities(existing.wbs_id, client, actorId);
      return { id: existing.id };
    });
  },
};
