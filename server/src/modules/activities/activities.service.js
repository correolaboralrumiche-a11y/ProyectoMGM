import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../errors/AppError.js';
import { computeDuration, isValidDateRange } from '../../utils/date.js';
import { activitiesRepository } from './activities.repository.js';

const ALLOWED_STATUSES = new Set([
  'Not Started',
  'In Progress',
  'Completed',
  'On Hold',
]);

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDefaultActivityId(projectId) {
  const rows = activitiesRepository.listActivityIdsByProject(projectId);
  const maxNumericSuffix = rows.reduce((maxValue, row) => {
    const value = String(row.activity_id || '').trim();
    const match = value.match(/(\d+)$/);

    if (!match) return maxValue;

    const numericValue = Number(match[1]);
    return Number.isFinite(numericValue) ? Math.max(maxValue, numericValue) : maxValue;
  }, 0);

  return `ACT-${String(maxNumericSuffix + 1).padStart(3, '0')}`;
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

  if (!ALLOWED_STATUSES.has(payload.status)) {
    throw new AppError('Invalid activity status', 400, {
      allowedStatuses: [...ALLOWED_STATUSES],
    });
  }
}

export const activitiesService = {
  listActivities(projectId) {
    if (!projectId) {
      throw new AppError('projectId is required', 400);
    }

    return activitiesRepository.listByProject(projectId);
  },

  createActivity(payload) {
    const wbsId = String(payload?.wbs_id || '').trim();
    const name = String(payload?.name || '').trim();

    if (!wbsId) {
      throw new AppError('wbs_id is required', 400);
    }

    if (!name) {
      throw new AppError('Activity name is required', 400);
    }

    const wbs = activitiesRepository.findWbsById(wbsId);

    if (!wbs) {
      throw new AppError('WBS not found', 404);
    }

    const startDate = payload?.start_date || null;
    const endDate = payload?.end_date || null;

    const activity = {
      id: uuidv4(),
      project_id: wbs.project_id,
      wbs_id: wbsId,
      activity_id:
        String(payload?.activity_id || '').trim() || buildDefaultActivityId(wbs.project_id),
      name,
      start_date: startDate,
      end_date: endDate,
      duration:
        startDate && endDate
          ? computeDuration(startDate, endDate)
          : Math.max(0, normalizeNumber(payload?.duration, 0)),
      progress: normalizeNumber(payload?.progress, 0),
      hours: normalizeNumber(payload?.hours, 0),
      cost: normalizeNumber(payload?.cost, 0),
      status: String(payload?.status || 'Not Started').trim() || 'Not Started',
      sort_order: activitiesRepository.getMaxSortOrder(wbsId) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    ensureValidActivityPayload(activity);

    const duplicate = activitiesRepository.findByProjectAndActivityId(
      activity.project_id,
      activity.activity_id
    );

    if (duplicate) {
      throw new AppError('Activity ID must be unique within the project', 409);
    }

    return activitiesRepository.create(activity);
  },

  updateActivity(activityId, payload) {
    const existing = activitiesRepository.findById(activityId);

    if (!existing) {
      throw new AppError('Activity not found', 404);
    }

    const targetWbsId = Object.prototype.hasOwnProperty.call(payload || {}, 'wbs_id')
      ? String(payload.wbs_id || '').trim()
      : existing.wbs_id;

    if (!targetWbsId) {
      throw new AppError('wbs_id is required', 400);
    }

    const wbs = activitiesRepository.findWbsById(targetWbsId);

    if (!wbs) {
      throw new AppError('WBS not found', 404);
    }

    const normalized = {
      project_id: wbs.project_id,
      wbs_id: targetWbsId,
      activity_id: String(payload?.activity_id ?? existing.activity_id).trim(),
      name: String(payload?.name ?? existing.name).trim(),
      start_date: Object.prototype.hasOwnProperty.call(payload || {}, 'start_date')
        ? payload.start_date || null
        : existing.start_date,
      end_date: Object.prototype.hasOwnProperty.call(payload || {}, 'end_date')
        ? payload.end_date || null
        : existing.end_date,
      progress: normalizeNumber(payload?.progress ?? existing.progress, existing.progress),
      hours: normalizeNumber(payload?.hours ?? existing.hours, existing.hours),
      cost: normalizeNumber(payload?.cost ?? existing.cost, existing.cost),
      status: String(payload?.status ?? existing.status).trim() || existing.status,
      updated_at: new Date().toISOString(),
    };

    normalized.duration =
      normalized.start_date && normalized.end_date
        ? computeDuration(normalized.start_date, normalized.end_date)
        : 0;

    ensureValidActivityPayload(normalized);

    const duplicate = activitiesRepository.findByProjectAndActivityId(
      normalized.project_id,
      normalized.activity_id,
      existing.id
    );

    if (duplicate) {
      throw new AppError('Activity ID must be unique within the project', 409);
    }

    return activitiesRepository.update(existing.id, normalized);
  },

  deleteActivity(activityId) {
    const existing = activitiesRepository.findById(activityId);

    if (!existing) {
      throw new AppError('Activity not found', 404);
    }

    activitiesRepository.remove(existing.id);
    return { id: existing.id };
  },
};