import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { baselinesRepository } from './baselines.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { extractActorId } from '../../utils/audit.js';

function baselineAuditSnapshot(baseline) {
  return {
    id: baseline.id,
    project_id: baseline.project_id,
    name: baseline.name,
    description: baseline.description || '',
    baseline_type: baseline.baseline_type,
    created_at: baseline.created_at,
    wbs_count: Number(baseline.wbs_count || 0),
    activities_count: Number(baseline.activities_count || 0),
  };
}

async function buildDefaultBaselineName(projectId) {
  const rows = await baselinesRepository.listByProject(projectId);
  const usedNames = new Set(rows.map((row) => String(row.name || '').trim().toUpperCase()));

  let counter = rows.length + 1;
  let candidate = `BL-${String(counter).padStart(2, '0')}`;

  while (usedNames.has(candidate.toUpperCase())) {
    counter += 1;
    candidate = `BL-${String(counter).padStart(2, '0')}`;
  }

  return candidate;
}

async function normalizeBaselineName(name, projectId) {
  const value = String(name || '').trim();
  return value || buildDefaultBaselineName(projectId);
}

export const baselinesService = {
  async listBaselines(projectId) {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }

    const project = await baselinesRepository.findProjectById(normalizedProjectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    return baselinesRepository.listByProject(normalizedProjectId);
  },

  async createBaseline(payload, actor, requestContext = {}) {
    const projectId = String(payload?.project_id || '').trim();
    if (!projectId) {
      throw new AppError('project_id is required', 400);
    }

    const project = await baselinesRepository.findProjectById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const baselineName = await normalizeBaselineName(payload?.name, projectId);
    const existing = await baselinesRepository.findBaselineByProjectAndName(projectId, baselineName);
    if (existing) {
      throw new AppError('A baseline with that name already exists for the project', 409);
    }

    const sourceWbs = await baselinesRepository.listProjectWbs(projectId);
    const sourceActivities = await baselinesRepository.listProjectActivities(projectId);

    if (sourceWbs.length === 0) {
      throw new AppError('Cannot create baseline for a project without WBS', 400);
    }

    const sourceWbsIds = new Set(sourceWbs.map((row) => row.id));
    for (const activity of sourceActivities) {
      if (!sourceWbsIds.has(activity.wbs_id)) {
        throw new AppError('Cannot create baseline with orphan activities', 400);
      }
    }

    const createdAt = new Date().toISOString();
    const baselineDescription = String(payload?.description || '').trim();
    const actorId = extractActorId(actor);

    const baseline = {
      project_id: projectId,
      name: baselineName,
      description: baselineDescription,
      project_name_snapshot: project.name,
      project_description_snapshot: project.description || '',
      source_project_created_at: project.created_at || null,
      created_at: createdAt,
      baseline_type: 'MANUAL',
      created_by: actorId,
      updated_by: actorId,
    };

    const baselineWbs = sourceWbs.map((row) => ({
      source_wbs_id: row.id,
      parent_source_wbs_id: row.parent_id || null,
      name: row.name,
      code: row.code,
      sort_order: Number(row.sort_order || 0),
    }));

    const baselineActivities = sourceActivities.map((row) => ({
      source_activity_id: row.id,
      source_wbs_id: row.wbs_id,
      project_id: projectId,
      activity_id: row.activity_id,
      name: row.name,
      start_date: row.start_date || null,
      end_date: row.end_date || null,
      duration: Number(row.duration || 0),
      progress: Number(row.progress || 0),
      hours: Number(row.hours || 0),
      cost: Number(row.cost || 0),
      status: row.status || 'Not Started',
      sort_order: Number(row.sort_order || 0),
      source_created_at: row.created_at || null,
      source_updated_at: row.updated_at || null,
      created_at,
    }));

    return withTransaction(async (client) => {
      const created = await baselinesRepository.createSnapshot(
        {
          baseline,
          baselineWbs,
          baselineActivities,
        },
        client
      );

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'baseline',
          entity_id: created.id,
          project_id: projectId,
          action: 'create',
          summary: `Baseline created: ${created.name}`,
          before_data: null,
          after_data: baselineAuditSnapshot(created),
          metadata: {
            source_wbs_count: baselineWbs.length,
            source_activities_count: baselineActivities.length,
          },
          ...requestContext,
        },
        client
      );

      return created;
    });
  },

  async getBaseline(baselineId) {
    const normalizedBaselineId = String(baselineId || '').trim();
    if (!normalizedBaselineId) {
      throw new AppError('baselineId is required', 400);
    }

    const baseline = await baselinesRepository.getBaselineHeader(normalizedBaselineId);
    if (!baseline) {
      throw new AppError('Baseline not found', 404);
    }

    return {
      baseline: await baselinesRepository.findBaselineById(normalizedBaselineId),
      wbs: await baselinesRepository.getBaselineWbs(normalizedBaselineId),
      activities: await baselinesRepository.getBaselineActivities(normalizedBaselineId),
    };
  },

  async deleteBaseline(baselineId, actor, requestContext = {}) {
    const normalizedBaselineId = String(baselineId || '').trim();
    if (!normalizedBaselineId) {
      throw new AppError('baselineId is required', 400);
    }

    const baseline = await baselinesRepository.getBaselineHeader(normalizedBaselineId);
    if (!baseline) {
      throw new AppError('Baseline not found', 404);
    }

    const actorId = extractActorId(actor);

    await withTransaction(async (client) => {
      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'baseline',
          entity_id: baseline.id,
          project_id: baseline.project_id,
          action: 'delete',
          summary: `Baseline deleted: ${baseline.name}`,
          before_data: baselineAuditSnapshot(baseline),
          after_data: null,
          ...requestContext,
        },
        client
      );

      await baselinesRepository.removeBaseline(normalizedBaselineId, client);
    });

    return { id: normalizedBaselineId };
  },
};
