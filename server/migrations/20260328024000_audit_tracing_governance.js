export async function up(knex) {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  const hasAuditLogs = await knex.schema.hasTable('audit_logs');
  if (!hasAuditLogs) {
    await knex.schema.createTable('audit_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table
        .uuid('actor_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.string('entity_type', 100).notNullable();
      table.text('entity_id').nullable();
      table.uuid('project_id').nullable();
      table.string('action', 100).notNullable();
      table.text('summary').notNullable().defaultTo('');
      table.jsonb('before_data').nullable();
      table.jsonb('after_data').nullable();
      table.jsonb('metadata').nullable();
      table.string('ip_address', 100).nullable();
      table.text('user_agent').nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  async function ensureUserTrackingColumns(tableName) {
    const hasCreatedBy = await knex.schema.hasColumn(tableName, 'created_by');
    if (!hasCreatedBy) {
      await knex.schema.alterTable(tableName, (table) => {
        table
          .uuid('created_by')
          .nullable()
          .references('id')
          .inTable('users')
          .onDelete('SET NULL');
      });
    }

    const hasUpdatedBy = await knex.schema.hasColumn(tableName, 'updated_by');
    if (!hasUpdatedBy) {
      await knex.schema.alterTable(tableName, (table) => {
        table
          .uuid('updated_by')
          .nullable()
          .references('id')
          .inTable('users')
          .onDelete('SET NULL');
      });
    }
  }

  await ensureUserTrackingColumns('projects');
  await ensureUserTrackingColumns('wbs_nodes');
  await ensureUserTrackingColumns('activities');
  await ensureUserTrackingColumns('project_baselines');

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs (actor_user_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs (project_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_entity_id ON audit_logs (entity_type, entity_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects (created_by)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_projects_updated_by ON projects (updated_by)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_wbs_nodes_created_by ON wbs_nodes (created_by)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_wbs_nodes_updated_by ON wbs_nodes (updated_by)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities (created_by)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_activities_updated_by ON activities (updated_by)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_baselines_created_by ON project_baselines (created_by)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_baselines_updated_by ON project_baselines (updated_by)');

  await knex('permissions')
    .insert({
      code: 'audit.read',
      name: 'Audit read',
      description: 'View audit trail and governance history',
    })
    .onConflict('code')
    .ignore();

  const adminRole = await knex('roles').select('id').where({ code: 'admin' }).first();
  const plannerRole = await knex('roles').select('id').where({ code: 'planner' }).first();
  const auditPermission = await knex('permissions').select('id').where({ code: 'audit.read' }).first();

  if (auditPermission?.id) {
    for (const role of [adminRole, plannerRole]) {
      if (!role?.id) continue;
      await knex('role_permissions')
        .insert({ role_id: role.id, permission_id: auditPermission.id })
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }
  }

  const adminUser = await knex('users')
    .select('id')
    .whereRaw('LOWER(username) = LOWER(?)', ['admin'])
    .first();

  if (adminUser?.id) {
    for (const tableName of ['projects', 'wbs_nodes', 'activities', 'project_baselines']) {
      await knex(tableName).whereNull('created_by').update({ created_by: adminUser.id });
      await knex(tableName).whereNull('updated_by').update({ updated_by: adminUser.id });
    }

    await knex('audit_logs')
      .insert({
        actor_user_id: adminUser.id,
        entity_type: 'system.migration',
        entity_id: '20260328024000_audit_tracing_governance',
        action: 'migration',
        summary: 'Sprint 3 audit and governance migration applied',
        metadata: {
          sprint: 'Sprint 3 - Auditoría, Trazabilidad y Gobierno del Dato',
        },
      });
  }
}

export async function down(knex) {
  const auditPermission = await knex('permissions').select('id').where({ code: 'audit.read' }).first();
  if (auditPermission?.id) {
    await knex('role_permissions').where({ permission_id: auditPermission.id }).del();
    await knex('permissions').where({ id: auditPermission.id }).del();
  }

  await knex.raw('DROP INDEX IF EXISTS idx_project_baselines_updated_by');
  await knex.raw('DROP INDEX IF EXISTS idx_project_baselines_created_by');
  await knex.raw('DROP INDEX IF EXISTS idx_activities_updated_by');
  await knex.raw('DROP INDEX IF EXISTS idx_activities_created_by');
  await knex.raw('DROP INDEX IF EXISTS idx_wbs_nodes_updated_by');
  await knex.raw('DROP INDEX IF EXISTS idx_wbs_nodes_created_by');
  await knex.raw('DROP INDEX IF EXISTS idx_projects_updated_by');
  await knex.raw('DROP INDEX IF EXISTS idx_projects_created_by');
  await knex.raw('DROP INDEX IF EXISTS idx_audit_logs_entity_type_entity_id');
  await knex.raw('DROP INDEX IF EXISTS idx_audit_logs_project_id');
  await knex.raw('DROP INDEX IF EXISTS idx_audit_logs_actor_user_id');
  await knex.raw('DROP INDEX IF EXISTS idx_audit_logs_created_at');

  for (const tableName of ['project_baselines', 'activities', 'wbs_nodes', 'projects']) {
    const hasUpdatedBy = await knex.schema.hasColumn(tableName, 'updated_by');
    if (hasUpdatedBy) {
      await knex.schema.alterTable(tableName, (table) => {
        table.dropColumn('updated_by');
      });
    }

    const hasCreatedBy = await knex.schema.hasColumn(tableName, 'created_by');
    if (hasCreatedBy) {
      await knex.schema.alterTable(tableName, (table) => {
        table.dropColumn('created_by');
      });
    }
  }

  await knex.schema.dropTableIfExists('audit_logs');
}
