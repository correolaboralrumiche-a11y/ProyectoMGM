export async function up(knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ix_audit_logs_project_created_at
    ON audit_logs (project_id, created_at DESC)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_created_at
    ON audit_logs (actor_user_id, created_at DESC)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_created_at
    ON audit_logs (entity_type, entity_id, created_at DESC)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ix_user_sessions_active_by_user
    ON user_sessions (user_id, expires_at DESC)
    WHERE revoked_at IS NULL
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ix_user_roles_role_user
    ON user_roles (role_id, user_id)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ix_role_permissions_permission_role
    ON role_permissions (permission_id, role_id)
  `);
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS ix_role_permissions_permission_role');
  await knex.raw('DROP INDEX IF EXISTS ix_user_roles_role_user');
  await knex.raw('DROP INDEX IF EXISTS ix_user_sessions_active_by_user');
  await knex.raw('DROP INDEX IF EXISTS ix_audit_logs_entity_created_at');
  await knex.raw('DROP INDEX IF EXISTS ix_audit_logs_actor_created_at');
  await knex.raw('DROP INDEX IF EXISTS ix_audit_logs_project_created_at');
}
