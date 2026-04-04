import { pool } from '../../config/db.js';

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : normalized;
}

function mapTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: row.description || row.notes || '',
    base_level: row.base_level,
    time_metric: row.time_metric,
    time_mode: row.time_mode,
    time_scale: row.time_scale,
    is_active: Boolean(row.is_active),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapTemplateColumn(row) {
  if (!row) return null;
  return {
    id: row.id,
    template_id: row.template_id,
    column_key: row.column_key,
    display_order: Number(row.display_order || 0),
    is_visible: Boolean(row.is_visible),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export const layoutTemplatesRepository = {
  async listByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, name, notes AS description, base_level, time_metric, time_mode, time_scale,
               is_active, created_by, updated_by, created_at, updated_at
        FROM layout_templates
        WHERE project_id = $1
          AND is_active = TRUE
        ORDER BY LOWER(name) ASC, created_at ASC
      `,
      [projectId],
    );

    return result.rows.map(mapTemplate);
  },

  async findById(id, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, name, notes AS description, base_level, time_metric, time_mode, time_scale,
               is_active, created_by, updated_by, created_at, updated_at
        FROM layout_templates
        WHERE id = $1
      `,
      [id],
    );

    return mapTemplate(result.rows[0]);
  },

  async findByProjectAndName(projectId, name, excludedId = null, executor = pool) {
    const params = excludedId ? [projectId, name, excludedId] : [projectId, name];
    const excludedClause = excludedId ? 'AND id <> $3' : '';
    const result = await executor.query(
      `
        SELECT id
        FROM layout_templates
        WHERE project_id = $1
          AND LOWER(name) = LOWER($2)
          AND is_active = TRUE
          ${excludedClause}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] || null;
  },

  async create(template, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO layout_templates (
          project_id,
          name,
          notes,
          base_level,
          time_metric,
          time_mode,
          time_scale,
          is_active,
          created_by,
          updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `,
      [
        template.project_id,
        template.name,
        template.description || '',
        template.base_level,
        template.time_metric,
        template.time_mode,
        template.time_scale,
        template.is_active !== false,
        template.created_by || null,
        template.updated_by || null,
      ],
    );

    return this.findById(result.rows[0].id, executor);
  },

  async update(id, patch, executor = pool) {
    await executor.query(
      `
        UPDATE layout_templates
        SET name = $2,
            notes = $3,
            base_level = $4,
            time_metric = $5,
            time_mode = $6,
            time_scale = $7,
            is_active = $8,
            updated_by = $9,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
        patch.name,
        patch.description || '',
        patch.base_level,
        patch.time_metric,
        patch.time_mode,
        patch.time_scale,
        patch.is_active !== false,
        patch.updated_by || null,
      ],
    );

    return this.findById(id, executor);
  },

  async deactivate(id, actorId, executor = pool) {
    await executor.query(
      `
        UPDATE layout_templates
        SET is_active = FALSE,
            updated_by = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, actorId || null],
    );

    return this.findById(id, executor);
  },

  async listColumns(templateId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, template_id, column_key, display_order, is_visible, created_at, updated_at
        FROM layout_template_columns
        WHERE template_id = $1
        ORDER BY display_order ASC, LOWER(column_key) ASC, id ASC
      `,
      [templateId],
    );

    return result.rows.map(mapTemplateColumn);
  },

  async replaceColumns(templateId, columns = [], executor = pool) {
    await executor.query(
      `
        DELETE FROM layout_template_columns
        WHERE template_id = $1
      `,
      [templateId],
    );

    for (const column of columns) {
      await executor.query(
        `
          INSERT INTO layout_template_columns (
            template_id,
            column_key,
            display_order,
            is_visible
          ) VALUES ($1,$2,$3,$4)
        `,
        [
          templateId,
          column.column_key,
          Number(column.display_order || 0),
          column.is_visible !== false,
        ],
      );
    }

    return this.listColumns(templateId, executor);
  },

  async findProjectById(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, code, name, description, status, priority_code, currency_code,
               created_at, updated_at
        FROM projects
        WHERE id = $1
      `,
      [projectId],
    );
    return result.rows[0] || null;
  },

  async listProjectFinancialPeriods(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT fp.id, fp.project_id, fp.period_code, fp.name,
               fp.start_date, fp.cutoff_date, fp.end_date, fp.sort_order,
               p.id AS snapshot_id, p.snapshot_date, p.status_code,
               p.summary_ev_amount, p.summary_weighted_progress,
               p.created_at AS snapshot_created_at
        FROM project_financial_periods fp
        LEFT JOIN LATERAL (
          SELECT id, financial_period_id, snapshot_date, status_code,
                 summary_ev_amount, summary_weighted_progress, created_at
          FROM project_control_periods p
          WHERE p.financial_period_id = fp.id
            AND p.is_active = TRUE
          ORDER BY p.created_at DESC
          LIMIT 1
        ) p ON TRUE
        WHERE fp.project_id = $1
          AND fp.is_active = TRUE
        ORDER BY fp.start_date ASC, fp.cutoff_date ASC, fp.sort_order ASC, fp.created_at ASC
      `,
      [projectId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      period_code: row.period_code,
      name: row.name,
      start_date: normalizeDateValue(row.start_date),
      cutoff_date: normalizeDateValue(row.cutoff_date),
      end_date: normalizeDateValue(row.end_date),
      sort_order: Number(row.sort_order || 0),
      snapshot_id: row.snapshot_id || null,
      snapshot_date: normalizeDateValue(row.snapshot_date),
      snapshot_status_code: row.status_code || null,
      summary_ev_amount: Number(row.summary_ev_amount || 0),
      summary_weighted_progress: Number(row.summary_weighted_progress || 0),
      snapshot_created_at: row.snapshot_created_at || null,
    }));
  },

  async listProjectSnapshots(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT p.id, p.project_id, p.financial_period_id, p.period_code, p.name,
               p.start_date, p.end_date, p.snapshot_date, p.status_code,
               fp.cutoff_date,
               s.activity_id, s.wbs_id, s.wbs_code, s.wbs_name,
               s.activity_code, s.activity_name,
               s.start_date AS activity_start_date,
               s.end_date AS activity_end_date,
               s.duration_days,
               s.progress_percent,
               s.budget_hours,
               s.budget_cost,
               s.baseline_start_date,
               s.baseline_end_date,
               s.baseline_duration_days,
               s.baseline_budget_hours,
               s.baseline_budget_cost,
               s.ev_amount,
               s.status_code AS activity_status_code,
               s.sort_order,
               s.captured_at
        FROM project_control_periods p
        LEFT JOIN project_financial_periods fp ON fp.id = p.financial_period_id
        INNER JOIN project_control_period_activity_snapshots s
          ON s.project_control_period_id = p.id
        WHERE p.project_id = $1
          AND p.is_active = TRUE
        ORDER BY p.snapshot_date ASC NULLS LAST, p.created_at ASC, s.sort_order ASC, LOWER(s.activity_code) ASC, s.id ASC
      `,
      [projectId],
    );

    return result.rows.map((row) => ({
      period_id: row.id,
      project_id: row.project_id,
      financial_period_id: row.financial_period_id || null,
      period_code: row.period_code,
      period_name: row.name,
      period_start_date: normalizeDateValue(row.start_date),
      period_end_date: normalizeDateValue(row.end_date),
      cutoff_date: normalizeDateValue(row.cutoff_date),
      snapshot_date: normalizeDateValue(row.snapshot_date),
      status_code: row.status_code,
      activity_id: row.activity_id,
      wbs_id: row.wbs_id,
      wbs_code: row.wbs_code || '',
      wbs_name: row.wbs_name || '',
      activity_code: row.activity_code || '',
      activity_name: row.activity_name || '',
      activity_start_date: normalizeDateValue(row.activity_start_date),
      activity_end_date: normalizeDateValue(row.activity_end_date),
      duration_days: Number(row.duration_days || 0),
      progress_percent: Number(row.progress_percent || 0),
      budget_hours: Number(row.budget_hours || 0),
      budget_cost: Number(row.budget_cost || 0),
      baseline_start_date: normalizeDateValue(row.baseline_start_date),
      baseline_end_date: normalizeDateValue(row.baseline_end_date),
      baseline_duration_days: Number(row.baseline_duration_days || 0),
      baseline_budget_hours: Number(row.baseline_budget_hours || 0),
      baseline_budget_cost: Number(row.baseline_budget_cost || 0),
      ev_amount: Number(row.ev_amount || 0),
      activity_status_code: row.activity_status_code || 'not_started',
      sort_order: Number(row.sort_order || 0),
      captured_at: row.captured_at,
    }));
  },
};
