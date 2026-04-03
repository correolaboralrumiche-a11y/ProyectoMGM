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

function mapDeliverable(row) {
  if (!row) return null;

  return {
    id: row.id,
    project_id: row.project_id,
    wbs_id: row.wbs_id,
    activity_id: row.activity_id,
    document_code: row.document_code,
    title: row.title,
    description: row.description || '',
    deliverable_type_code: row.deliverable_type_code,
    deliverable_type_name: row.deliverable_type_name || null,
    discipline_code: row.discipline_code,
    discipline_name: row.discipline_name || null,
    priority_code: row.priority_code,
    priority_name: row.priority_name || null,
    status_code: row.status_code,
    status_name: row.status_name || null,
    originator: row.originator || '',
    responsible_person: row.responsible_person || '',
    spec_section: row.spec_section || '',
    package_no: row.package_no || '',
    planned_issue_date: normalizeDateValue(row.planned_issue_date),
    forecast_issue_date: normalizeDateValue(row.forecast_issue_date),
    actual_issue_date: normalizeDateValue(row.actual_issue_date),
    planned_response_date: normalizeDateValue(row.planned_response_date),
    forecast_response_date: normalizeDateValue(row.forecast_response_date),
    actual_response_date: normalizeDateValue(row.actual_response_date),
    current_revision_code: row.current_revision_code || '',
    current_response_code: row.current_response_code || '',
    current_response_name: row.current_response_name || null,
    current_issue_transmittal_no: row.current_issue_transmittal_no || '',
    current_response_transmittal_no: row.current_response_transmittal_no || '',
    remarks: row.remarks || '',
    is_active: Boolean(row.is_active),
    revision_count: Number(row.revision_count || 0),
    last_revision_sequence: Number(row.last_revision_sequence || 0),
    wbs_code: row.wbs_code || '',
    wbs_name: row.wbs_name || '',
    activity_code: row.activity_code || '',
    activity_name: row.activity_name || '',
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapRevision(row) {
  if (!row) return null;

  return {
    id: row.id,
    deliverable_id: row.deliverable_id,
    revision_sequence: Number(row.revision_sequence || 0),
    revision_code: row.revision_code,
    issue_purpose_code: row.issue_purpose_code,
    issue_purpose_name: row.issue_purpose_name || null,
    issue_date: normalizeDateValue(row.issue_date),
    issue_transmittal_no: row.issue_transmittal_no || '',
    planned_response_date: normalizeDateValue(row.planned_response_date),
    response_date: normalizeDateValue(row.response_date),
    response_code: row.response_code || '',
    response_name: row.response_name || null,
    response_transmittal_no: row.response_transmittal_no || '',
    response_by: row.response_by || '',
    remarks: row.remarks || '',
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const DELIVERABLE_SELECT = `
  d.id,
  d.project_id,
  d.wbs_id,
  d.activity_id,
  d.document_code,
  d.title,
  d.description,
  d.deliverable_type_code,
  dt.name AS deliverable_type_name,
  d.discipline_code,
  di.name AS discipline_name,
  d.priority_code,
  pr.name AS priority_name,
  d.status_code,
  ds.name AS status_name,
  d.originator,
  d.responsible_person,
  d.spec_section,
  d.package_no,
  d.planned_issue_date,
  d.forecast_issue_date,
  d.actual_issue_date,
  d.planned_response_date,
  d.forecast_response_date,
  d.actual_response_date,
  d.current_revision_code,
  d.current_response_code,
  rc.name AS current_response_name,
  d.current_issue_transmittal_no,
  d.current_response_transmittal_no,
  d.remarks,
  d.is_active,
  d.created_by,
  d.updated_by,
  d.created_at,
  d.updated_at,
  w.code AS wbs_code,
  w.name AS wbs_name,
  a.activity_id AS activity_code,
  a.name AS activity_name,
  COALESCE(rv.revision_count, 0) AS revision_count,
  COALESCE(rv.last_revision_sequence, 0) AS last_revision_sequence
`;

const DELIVERABLE_FROM = `
  FROM deliverables d
  LEFT JOIN deliverable_types dt ON dt.code = d.deliverable_type_code
  LEFT JOIN deliverable_statuses ds ON ds.code = d.status_code
  LEFT JOIN document_response_codes rc ON rc.code = d.current_response_code
  LEFT JOIN disciplines di ON di.code = d.discipline_code
  LEFT JOIN project_priorities pr ON pr.code = d.priority_code
  LEFT JOIN wbs_nodes w ON w.id = d.wbs_id
  LEFT JOIN activities a ON a.id = d.activity_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS revision_count,
      COALESCE(MAX(r.revision_sequence), 0) AS last_revision_sequence
    FROM deliverable_revisions r
    WHERE r.deliverable_id = d.id
  ) rv ON TRUE
`;

export const deliverablesRepository = {
  async listByProject(projectId, filters = {}, executor = pool) {
    const where = ['d.project_id = $1', 'd.is_active = TRUE'];
    const params = [projectId];

    if (filters.status_code) {
      params.push(filters.status_code);
      where.push(`d.status_code = $${params.length}`);
    }

    if (filters.discipline_code) {
      params.push(filters.discipline_code);
      where.push(`d.discipline_code = $${params.length}`);
    }

    if (filters.deliverable_type_code) {
      params.push(filters.deliverable_type_code);
      where.push(`d.deliverable_type_code = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${String(filters.search).trim().toLowerCase()}%`);
      where.push(`(LOWER(d.document_code) LIKE $${params.length} OR LOWER(d.title) LIKE $${params.length})`);
    }

    const result = await executor.query(
      `
        SELECT ${DELIVERABLE_SELECT}
        ${DELIVERABLE_FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY LOWER(d.document_code) ASC, d.created_at DESC
      `,
      params,
    );

    return result.rows.map(mapDeliverable);
  },

  async findById(id, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${DELIVERABLE_SELECT}
        ${DELIVERABLE_FROM}
        WHERE d.id = $1
      `,
      [id],
    );

    return mapDeliverable(result.rows[0]);
  },

  async findByDocumentCode(documentCode, excludedId = null, executor = pool) {
    const params = [documentCode];
    const excludedClause = excludedId ? 'AND id <> $2' : '';
    if (excludedId) params.push(excludedId);

    const result = await executor.query(
      `
        SELECT id
        FROM deliverables
        WHERE LOWER(document_code) = LOWER($1)
          ${excludedClause}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] || null;
  },

  async create(deliverable, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO deliverables (
          project_id,
          wbs_id,
          activity_id,
          document_code,
          title,
          description,
          deliverable_type_code,
          discipline_code,
          priority_code,
          status_code,
          originator,
          responsible_person,
          spec_section,
          package_no,
          planned_issue_date,
          forecast_issue_date,
          actual_issue_date,
          planned_response_date,
          forecast_response_date,
          actual_response_date,
          current_revision_code,
          current_response_code,
          current_issue_transmittal_no,
          current_response_transmittal_no,
          remarks,
          is_active,
          created_by,
          updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28
        )
        RETURNING id
      `,
      [
        deliverable.project_id,
        deliverable.wbs_id,
        deliverable.activity_id,
        deliverable.document_code,
        deliverable.title,
        deliverable.description,
        deliverable.deliverable_type_code,
        deliverable.discipline_code,
        deliverable.priority_code,
        deliverable.status_code,
        deliverable.originator,
        deliverable.responsible_person,
        deliverable.spec_section,
        deliverable.package_no,
        deliverable.planned_issue_date,
        deliverable.forecast_issue_date,
        deliverable.actual_issue_date,
        deliverable.planned_response_date,
        deliverable.forecast_response_date,
        deliverable.actual_response_date,
        deliverable.current_revision_code || null,
        deliverable.current_response_code || null,
        deliverable.current_issue_transmittal_no || '',
        deliverable.current_response_transmittal_no || '',
        deliverable.remarks,
        deliverable.is_active,
        deliverable.created_by || null,
        deliverable.updated_by || null,
      ],
    );

    return this.findById(result.rows[0].id, executor);
  },

  async update(id, deliverable, executor = pool) {
    await executor.query(
      `
        UPDATE deliverables
        SET
          wbs_id = $2,
          activity_id = $3,
          document_code = $4,
          title = $5,
          description = $6,
          deliverable_type_code = $7,
          discipline_code = $8,
          priority_code = $9,
          status_code = $10,
          originator = $11,
          responsible_person = $12,
          spec_section = $13,
          package_no = $14,
          planned_issue_date = $15,
          forecast_issue_date = $16,
          actual_issue_date = $17,
          planned_response_date = $18,
          forecast_response_date = $19,
          actual_response_date = $20,
          current_revision_code = $21,
          current_response_code = $22,
          current_issue_transmittal_no = $23,
          current_response_transmittal_no = $24,
          remarks = $25,
          is_active = $26,
          updated_by = $27,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
        deliverable.wbs_id,
        deliverable.activity_id,
        deliverable.document_code,
        deliverable.title,
        deliverable.description,
        deliverable.deliverable_type_code,
        deliverable.discipline_code,
        deliverable.priority_code,
        deliverable.status_code,
        deliverable.originator,
        deliverable.responsible_person,
        deliverable.spec_section,
        deliverable.package_no,
        deliverable.planned_issue_date,
        deliverable.forecast_issue_date,
        deliverable.actual_issue_date,
        deliverable.planned_response_date,
        deliverable.forecast_response_date,
        deliverable.actual_response_date,
        deliverable.current_revision_code || null,
        deliverable.current_response_code || null,
        deliverable.current_issue_transmittal_no || '',
        deliverable.current_response_transmittal_no || '',
        deliverable.remarks,
        deliverable.is_active,
        deliverable.updated_by || null,
      ],
    );

    return this.findById(id, executor);
  },

  async deactivate(id, actorId, executor = pool) {
    await executor.query(
      `
        UPDATE deliverables
        SET is_active = FALSE, updated_by = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [id, actorId || null],
    );

    return this.findById(id, executor);
  },

  async listRevisions(deliverableId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          r.id,
          r.deliverable_id,
          r.revision_sequence,
          r.revision_code,
          r.issue_purpose_code,
          rp.name AS issue_purpose_name,
          r.issue_date,
          r.issue_transmittal_no,
          r.planned_response_date,
          r.response_date,
          r.response_code,
          rc.name AS response_name,
          r.response_transmittal_no,
          r.response_by,
          r.remarks,
          r.created_by,
          r.updated_by,
          r.created_at,
          r.updated_at
        FROM deliverable_revisions r
        LEFT JOIN revision_purposes rp ON rp.code = r.issue_purpose_code
        LEFT JOIN document_response_codes rc ON rc.code = r.response_code
        WHERE r.deliverable_id = $1
        ORDER BY r.revision_sequence DESC, r.created_at DESC
      `,
      [deliverableId],
    );

    return result.rows.map(mapRevision);
  },

  async findRevisionById(deliverableId, revisionId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          r.id,
          r.deliverable_id,
          r.revision_sequence,
          r.revision_code,
          r.issue_purpose_code,
          rp.name AS issue_purpose_name,
          r.issue_date,
          r.issue_transmittal_no,
          r.planned_response_date,
          r.response_date,
          r.response_code,
          rc.name AS response_name,
          r.response_transmittal_no,
          r.response_by,
          r.remarks,
          r.created_by,
          r.updated_by,
          r.created_at,
          r.updated_at
        FROM deliverable_revisions r
        LEFT JOIN revision_purposes rp ON rp.code = r.issue_purpose_code
        LEFT JOIN document_response_codes rc ON rc.code = r.response_code
        WHERE r.deliverable_id = $1 AND r.id = $2
      `,
      [deliverableId, revisionId],
    );

    return mapRevision(result.rows[0]);
  },

  async getNextRevisionSequence(deliverableId, executor = pool) {
    const result = await executor.query(
      `
        SELECT COALESCE(MAX(revision_sequence), 0) + 1 AS next_value
        FROM deliverable_revisions
        WHERE deliverable_id = $1
      `,
      [deliverableId],
    );

    return Number(result.rows[0]?.next_value || 1);
  },

  async createRevision(revision, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO deliverable_revisions (
          deliverable_id,
          revision_sequence,
          revision_code,
          issue_purpose_code,
          issue_date,
          issue_transmittal_no,
          planned_response_date,
          response_date,
          response_code,
          response_transmittal_no,
          response_by,
          remarks,
          created_by,
          updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )
        RETURNING id
      `,
      [
        revision.deliverable_id,
        revision.revision_sequence,
        revision.revision_code,
        revision.issue_purpose_code,
        revision.issue_date,
        revision.issue_transmittal_no,
        revision.planned_response_date,
        revision.response_date,
        revision.response_code || null,
        revision.response_transmittal_no,
        revision.response_by,
        revision.remarks,
        revision.created_by || null,
        revision.updated_by || null,
      ],
    );

    return this.findRevisionById(revision.deliverable_id, result.rows[0].id, executor);
  },

  async updateRevision(deliverableId, revisionId, revision, executor = pool) {
    await executor.query(
      `
        UPDATE deliverable_revisions
        SET
          revision_code = $3,
          issue_purpose_code = $4,
          issue_date = $5,
          issue_transmittal_no = $6,
          planned_response_date = $7,
          response_date = $8,
          response_code = $9,
          response_transmittal_no = $10,
          response_by = $11,
          remarks = $12,
          updated_by = $13,
          updated_at = NOW()
        WHERE id = $1 AND deliverable_id = $2
      `,
      [
        revisionId,
        deliverableId,
        revision.revision_code,
        revision.issue_purpose_code,
        revision.issue_date,
        revision.issue_transmittal_no,
        revision.planned_response_date,
        revision.response_date,
        revision.response_code || null,
        revision.response_transmittal_no,
        revision.response_by,
        revision.remarks,
        revision.updated_by || null,
      ],
    );

    return this.findRevisionById(deliverableId, revisionId, executor);
  },
};
