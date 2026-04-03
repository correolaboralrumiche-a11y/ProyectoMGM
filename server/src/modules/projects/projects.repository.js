import { pool } from '../../config/db.js';

function mapProject(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    status_code: row.status_code || row.status,
    status_name: row.status_name || null,
    status: row.status_name || row.status_code || row.status,
    priority_code: row.priority_code || 'medium',
    priority_name: row.priority_name || null,
    currency_code: row.currency_code || 'USD',
    currency_name: row.currency_name || null,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const PROJECT_SELECT_COLUMNS = `
  p.id,
  p.code,
  p.name,
  p.description,
  p.status AS status_code,
  ps.name AS status_name,
  p.priority_code,
  pp.name AS priority_name,
  p.currency_code,
  c.name AS currency_name,
  p.created_by,
  p.updated_by,
  p.created_at,
  p.updated_at
`;

const PROJECT_BASE_JOINS = `
  FROM projects p
  LEFT JOIN project_statuses ps ON ps.code = p.status
  LEFT JOIN project_priorities pp ON pp.code = p.priority_code
  LEFT JOIN currencies c ON c.code = p.currency_code
`;

export const projectsRepository = {
  async list(executor = pool) {
    const result = await executor.query(
      `
        SELECT
          ${PROJECT_SELECT_COLUMNS}
        ${PROJECT_BASE_JOINS}
        ORDER BY p.created_at DESC, p.name ASC
      `
    );

    return result.rows.map(mapProject);
  },

  async findById(id, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          ${PROJECT_SELECT_COLUMNS}
        ${PROJECT_BASE_JOINS}
        WHERE p.id = $1
      `,
      [id]
    );

    return mapProject(result.rows[0]);
  },

  async findByCode(code, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          ${PROJECT_SELECT_COLUMNS}
        ${PROJECT_BASE_JOINS}
        WHERE p.code = $1
      `,
      [code]
    );

    return mapProject(result.rows[0]);
  },

  async create(project, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO projects (
          code,
          name,
          description,
          status,
          priority_code,
          currency_code,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        project.code,
        project.name,
        project.description,
        project.status_code,
        project.priority_code,
        project.currency_code,
        project.created_by || null,
        project.updated_by || null,
      ]
    );

    return this.findById(result.rows[0].id, executor);
  },

  async update(id, changes, executor = pool) {
    const result = await executor.query(
      `
        UPDATE projects
        SET
          name = $2,
          description = $3,
          status = $4,
          priority_code = $5,
          currency_code = $6,
          updated_by = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [
        id,
        changes.name,
        changes.description,
        changes.status_code,
        changes.priority_code,
        changes.currency_code,
        changes.updated_by || null,
      ]
    );

    return this.findById(result.rows[0]?.id || id, executor);
  },

  async remove(id, executor = pool) {
    await executor.query(
      `
        DELETE FROM projects
        WHERE id = $1
      `,
      [id]
    );
  },
};
