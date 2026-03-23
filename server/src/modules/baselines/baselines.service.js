import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../errors/AppError.js';
import { baselinesRepository } from './baselines.repository.js';

function buildDefaultBaselineName(projectId) {
  const rows = baselinesRepository.listByProject(projectId);
  const usedNames = new Set(rows.map((row) => String(row.name || '').trim().toUpperCase()));

  let counter = rows.length + 1;
  let candidate = `BL-${String(counter).padStart(2, '0')}`;

  while (usedNames.has(candidate.toUpperCase())) {
    counter += 1;
    candidate = `BL-${String(counter).padStart(2, '0')}`;
  }

  return candidate;
}

function normalizeBaselineName(name, projectId) {
  const value = String(name || '').trim();
  return value || buildDefaultBaselineName(projectId);
}

export const baselinesService = {
  listBaselines(projectId) {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }

    const project = baselinesRepository.findProjectById(normalizedProjectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    return baselinesRepository.listByProject(normalizedProjectId);
  },

  createBaseline(payload) {
    const projectId = String(payload?.project_id || '').trim();
    if (!projectId) {
      throw new AppError('project_id is required', 400);
    }

    const project = baselinesRepository.findProjectById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const baselineName = normalizeBaselineName(payload?.name, projectId);
    const existing = baselinesRepository.findBaselineByProjectAndName(projectId, baselineName);
    if (existing) {
      throw new AppError('A baseline with that name already exists for the project', 409);
    }

    const sourceWbs = baselinesRepository.listProjectWbs(projectId);
    const sourceActivities = baselinesRepository.listProjectActivities(projectId);

    if (sourceWbs.length === 0) {
      throw new AppError('Cannot create baseline for a project without WBS', 400);
    }

    const baselineId = uuidv4();
    const createdAt = new Date().toISOString();
    const baselineDescription = String(payload?.description || '').trim();

    const baseline = {
      id: baselineId,
      project_id: projectId,
      name: baselineName,
      description: baselineDescription,
      project_name_snapshot: project.name,
      project_description_snapshot: project.description || '',
      source_project_created_at: project.created_at || null,
      created_at: createdAt,
      baseline_type: 'MANUAL',
    };

    const baselineWbsIdBySourceId = new Map();

    const baselineWbs = sourceWbs.map((row) => {
      const id = uuidv4();
      baselineWbsIdBySourceId.set(row.id, id);
      return {
        id,
        baseline_id: baselineId,
        source_wbs_id: row.id,
        parent_id: null,
        name: row.name,
        code: row.code,
        sort_order: Number(row.sort_order || 0),
      };
    });

    for (let index = 0; index < sourceWbs.length; index += 1) {
      const source = sourceWbs[index];
      baselineWbs[index].parent_id = source.parent_id
        ? baselineWbsIdBySourceId.get(source.parent_id) || null
        : null;
    }

    const baselineActivities = sourceActivities.map((row) => {
      const baselineWbsId = baselineWbsIdBySourceId.get(row.wbs_id);
      if (!baselineWbsId) {
        throw new AppError(
          `Could not resolve baseline WBS for activity ${row.activity_id || row.id}`,
          500
        );
      }

      return {
        id: uuidv4(),
        baseline_id: baselineId,
        baseline_wbs_id: baselineWbsId,
        source_activity_id: row.id,
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
        created_at: createdAt,
      };
    });

    return baselinesRepository.createSnapshot({
      baseline,
      baselineWbs,
      baselineActivities,
    });
  },

  getBaseline(baselineId) {
    const normalizedBaselineId = String(baselineId || '').trim();
    if (!normalizedBaselineId) {
      throw new AppError('baselineId is required', 400);
    }

    const baseline = baselinesRepository.getBaselineHeader(normalizedBaselineId);
    if (!baseline) {
      throw new AppError('Baseline not found', 404);
    }

    return {
      baseline: baselinesRepository.findBaselineById(normalizedBaselineId),
      wbs: baselinesRepository.getBaselineWbs(normalizedBaselineId),
      activities: baselinesRepository.getBaselineActivities(normalizedBaselineId),
    };
  },

  deleteBaseline(baselineId) {
    const normalizedBaselineId = String(baselineId || '').trim();
    if (!normalizedBaselineId) {
      throw new AppError('baselineId is required', 400);
    }

    const baseline = baselinesRepository.getBaselineHeader(normalizedBaselineId);
    if (!baseline) {
      throw new AppError('Baseline not found', 404);
    }

    baselinesRepository.removeBaseline(normalizedBaselineId);
    return { id: normalizedBaselineId };
  },
};
