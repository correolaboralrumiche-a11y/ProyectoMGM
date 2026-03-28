import { pool } from '../../config/db.js';

function mapUser(row) {
  if (!row) return null;

  return {
    id: row.user_id || row.id,
    username: row.username,
    email: row.email,
    full_name: row.full_name,
    status: row.status,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    roles: Array.isArray(row.role_codes) ? row.role_codes.filter(Boolean) : [],
    permissions: Array.isArray(row.permission_codes) ? row.permission_codes.filter(Boolean) : [],
  };
}

function mapSessionContext(row) {
  if (!row) return null;

  return {
    session_id: row.session_id,
    user_id: row.user_id,
    session_expires_at: row.session_expires_at,
    session_last_seen_at: row.session_last_seen_at,
    user: mapUser(row),
  };
}

export const authRepository = {
  async findUserForLogin(identifier, executor = pool) {
    const value = String(identifier || '').trim();
    const result = await executor.query(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.password_hash,
          u.status,
          u.last_login_at,
          u.created_at,
          u.updated_at
        FROM users u
        WHERE LOWER(u.username) = LOWER($1)
           OR LOWER(COALESCE(u.email, '')) = LOWER($1)
        LIMIT 1
      `,
      [value]
    );

    return result.rows[0] || null;
  },

  async getUserAccessById(userId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.status,
          u.last_login_at,
          u.created_at,
          u.updated_at,
          COALESCE(ARRAY_AGG(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS role_codes,
          COALESCE(ARRAY_AGG(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permission_codes
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = $1
        GROUP BY u.id, u.username, u.email, u.full_name, u.status, u.last_login_at, u.created_at, u.updated_at
      `,
      [userId]
    );

    return mapUser(result.rows[0]);
  },

  async updateLastLoginAt(userId, executor = pool) {
    await executor.query(
      `
        UPDATE users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [userId]
    );
  },

  async createSession(session, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO user_sessions (
          user_id,
          token_hash,
          expires_at,
          user_agent,
          ip_address
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, expires_at, created_at, last_seen_at
      `,
      [
        session.user_id,
        session.token_hash,
        session.expires_at,
        session.user_agent || null,
        session.ip_address || null,
      ]
    );

    return result.rows[0] || null;
  },

  async revokeSessionByTokenHash(tokenHash, executor = pool) {
    await executor.query(
      `
        UPDATE user_sessions
        SET revoked_at = NOW()
        WHERE token_hash = $1
          AND revoked_at IS NULL
      `,
      [tokenHash]
    );
  },

  async touchSession(sessionId, executor = pool) {
    await executor.query(
      `
        UPDATE user_sessions
        SET last_seen_at = NOW()
        WHERE id = $1
          AND last_seen_at < NOW() - INTERVAL '5 minutes'
      `,
      [sessionId]
    );
  },

  async findSessionContextByTokenHash(tokenHash, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
          s.expires_at AS session_expires_at,
          s.last_seen_at AS session_last_seen_at,
          u.id AS user_id,
          u.username,
          u.email,
          u.full_name,
          u.status,
          u.last_login_at,
          u.created_at,
          u.updated_at,
          COALESCE(ARRAY_AGG(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS role_codes,
          COALESCE(ARRAY_AGG(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permission_codes
        FROM user_sessions s
        INNER JOIN users u ON u.id = s.user_id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.status = 'active'
        GROUP BY
          s.id,
          s.user_id,
          s.expires_at,
          s.last_seen_at,
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.status,
          u.last_login_at,
          u.created_at,
          u.updated_at
        LIMIT 1
      `,
      [tokenHash]
    );

    return mapSessionContext(result.rows[0]);
  },
};
