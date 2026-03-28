import { pool } from '../../config/db.js';
import { sanitizeAuditValue } from '../../utils/audit.js';

function mapAuditLog(row) {
  if (!row) return null;

  return {
    id: row.id,
    actor_user_id: row.actor_user_id,
    actor: row.actor_user_id
      ? {
          id: row.actor_user_id,
          username: row.actor_username,
          full_name: row.actor_full_name,
          email: row.actor_email,
        }
      : null,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    project_id: row.project_id,
    action: row.action,
    summary: row.summary,
    before_data: row.before_data || null,
    after_data: row.after_data || null,
    metadata: row.metadata || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    created_at: row.created_at,
  };
}

export const auditRepository = {
  async create(entry, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO audit_logs (
          actor_user_id,
          entity_type,
          entity_id,
          project_id,
          action,
          summary,
          before_data,
          after_data,
          metadata,
          ip_address,
          user_agent
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10,
          $11
        )
        RETURNING *
      `,
      [
        entry.actor_user_id || null,
        entry.entity_type,
        entry.entity_id || null,
        entry.project_id || null,
        entry.action,
        entry.summary || '',
        entry.before_data == null ? null : JSON.stringify(sanitizeAuditValue(entry.before_data)),
        entry.after_data == null ? null : JSON.stringify(sanitizeAuditValue(entry.after_data)),
        entry.metadata == null ? null : JSON.stringify(sanitizeAuditValue(entry.metadata)),
        entry.ip_address || null,
        entry.user_agent || null,
      ]
    );

    return mapAuditLog(result.rows[0]);
  },

  async list(filters = {}, executor = pool) {
    const clauses = [];
    const params = [];
    let index = 1;

    if (filters.project_id) {
      clauses.push(`l.project_id = $${index}`);
      params.push(filters.project_id);
      index += 1;
    }

    if (filters.entity_type) {
      clauses.push(`l.entity_type = $${index}`);
      params.push(filters.entity_type);
      index += 1;
    }

    if (filters.entity_id) {
      clauses.push(`l.entity_id = $${index}`);
      params.push(filters.entity_id);
      index += 1;
    }

    if (filters.action) {
      clauses.push(`l.action = $${index}`);
      params.push(filters.action);
      index += 1;
    }

    if (filters.actor_user_id) {
      clauses.push(`l.actor_user_id = $${index}`);
      params.push(filters.actor_user_id);
      index += 1;
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await executor.query(
      `
        SELECT
          l.*,
          u.username AS actor_username,
          u.full_name AS actor_full_name,
          u.email AS actor_email
        FROM audit_logs l
        LEFT JOIN users u ON u.id = l.actor_user_id
        ${whereSql}
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT $${index}
      `,
      [...params, limit]
    );

    return result.rows.map(mapAuditLog);
  },
};
