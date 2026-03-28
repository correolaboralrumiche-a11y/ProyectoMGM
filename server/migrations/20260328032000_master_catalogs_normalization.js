export async function up(knex) {
  const hasProjectStatuses = await knex.schema.hasTable('project_statuses');
  if (!hasProjectStatuses) {
    await knex.schema.createTable('project_statuses', (table) => {
      table.string('code', 50).primary();
      table.string('name', 120).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasActivityStatuses = await knex.schema.hasTable('activity_statuses');
  if (!hasActivityStatuses) {
    await knex.schema.createTable('activity_statuses', (table) => {
      table.string('code', 50).primary();
      table.string('name', 120).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasActivityTypes = await knex.schema.hasTable('activity_types');
  if (!hasActivityTypes) {
    await knex.schema.createTable('activity_types', (table) => {
      table.string('code', 50).primary();
      table.string('name', 120).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasActivityPriorities = await knex.schema.hasTable('activity_priorities');
  if (!hasActivityPriorities) {
    await knex.schema.createTable('activity_priorities', (table) => {
      table.string('code', 50).primary();
      table.string('name', 120).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const adminUser = await knex('users').select('id').whereRaw('LOWER(username) = LOWER(?)', ['admin']).first();
  const actorId = adminUser?.id || null;

  const seed = async (table, rows) => {
    for (const row of rows) {
      await knex(table)
        .insert({ ...row, created_by: actorId, updated_by: actorId })
        .onConflict('code')
        .merge({
          name: row.name,
          description: row.description,
          is_active: row.is_active,
          sort_order: row.sort_order,
          updated_by: actorId,
          updated_at: knex.fn.now(),
        });
    }
  };

  await seed('project_statuses', [
    { code: 'active', name: 'Activo', description: 'Proyecto operativo', is_active: true, sort_order: 10 },
    { code: 'inactive', name: 'Inactivo', description: 'Proyecto detenido temporalmente', is_active: true, sort_order: 20 },
    { code: 'archived', name: 'Archivado', description: 'Proyecto cerrado o archivado', is_active: true, sort_order: 30 },
  ]);

  await seed('activity_statuses', [
    { code: 'not_started', name: 'Not Started', description: 'Actividad sin iniciar', is_active: true, sort_order: 10 },
    { code: 'in_progress', name: 'In Progress', description: 'Actividad en ejecución', is_active: true, sort_order: 20 },
    { code: 'completed', name: 'Completed', description: 'Actividad completada', is_active: true, sort_order: 30 },
    { code: 'on_hold', name: 'On Hold', description: 'Actividad en pausa', is_active: true, sort_order: 40 },
  ]);

  await seed('activity_types', [
    { code: 'task', name: 'Task', description: 'Actividad estándar', is_active: true, sort_order: 10 },
    { code: 'milestone', name: 'Milestone', description: 'Hito o punto de control', is_active: true, sort_order: 20 },
    { code: 'deliverable', name: 'Deliverable', description: 'Entregable formal', is_active: true, sort_order: 30 },
    { code: 'review', name: 'Review', description: 'Revisión o validación', is_active: true, sort_order: 40 },
  ]);

  await seed('activity_priorities', [
    { code: 'low', name: 'Low', description: 'Prioridad baja', is_active: true, sort_order: 10 },
    { code: 'medium', name: 'Medium', description: 'Prioridad media', is_active: true, sort_order: 20 },
    { code: 'high', name: 'High', description: 'Prioridad alta', is_active: true, sort_order: 30 },
    { code: 'critical', name: 'Critical', description: 'Prioridad crítica', is_active: true, sort_order: 40 },
  ]);

  if (!(await knex.schema.hasColumn('activities', 'activity_type_code'))) {
    await knex.schema.alterTable('activities', (table) => {
      table.string('activity_type_code', 50).notNullable().defaultTo('task');
    });
  }

  if (!(await knex.schema.hasColumn('activities', 'priority_code'))) {
    await knex.schema.alterTable('activities', (table) => {
      table.string('priority_code', 50).notNullable().defaultTo('medium');
    });
  }

  await knex.raw(`
    UPDATE projects
    SET status = CASE
      WHEN status IS NULL OR BTRIM(status) = '' THEN 'active'
      WHEN LOWER(BTRIM(status)) IN ('active', 'activo') THEN 'active'
      WHEN LOWER(BTRIM(status)) IN ('inactive', 'inactivo') THEN 'inactive'
      WHEN LOWER(BTRIM(status)) IN ('archived', 'archivado') THEN 'archived'
      ELSE 'active'
    END
  `);

  await knex.raw(`
    UPDATE activities
    SET status = CASE
      WHEN status IS NULL OR BTRIM(status) = '' THEN 'not_started'
      WHEN LOWER(BTRIM(status)) IN ('not started', 'not_started') THEN 'not_started'
      WHEN LOWER(BTRIM(status)) IN ('in progress', 'in_progress') THEN 'in_progress'
      WHEN LOWER(BTRIM(status)) IN ('completed') THEN 'completed'
      WHEN LOWER(BTRIM(status)) IN ('on hold', 'on_hold') THEN 'on_hold'
      ELSE 'not_started'
    END
  `);

  await knex.raw(`
    UPDATE activities
    SET activity_type_code = COALESCE(NULLIF(BTRIM(activity_type_code), ''), 'task'),
        priority_code = COALESCE(NULLIF(BTRIM(priority_code), ''), 'medium')
  `);

  const permissions = [
    ['catalogs.read', 'Catalogs read', 'View master catalogs'],
    ['catalogs.write', 'Catalogs write', 'Create and update master catalogs'],
  ];

  for (const [code, name, description] of permissions) {
    await knex('permissions').insert({ code, name, description }).onConflict('code').ignore();
  }

  const permissionRows = await knex('permissions').select('id', 'code');
  const roleRows = await knex('roles').select('id', 'code');
  const permissionByCode = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleByCode = new Map(roleRows.map((row) => [row.code, row.id]));

  const rolePermissionMap = {
    admin: ['catalogs.read', 'catalogs.write'],
    planner: ['catalogs.read'],
    viewer: ['catalogs.read'],
  };

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
    const roleId = roleByCode.get(roleCode);
    if (!roleId) continue;

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) continue;

      await knex('role_permissions')
        .insert({ role_id: roleId, permission_id: permissionId })
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }
  }

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_status_catalog'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT fk_projects_status_catalog
        FOREIGN KEY (status) REFERENCES project_statuses(code);
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_activities_status_catalog'
      ) THEN
        ALTER TABLE activities
        ADD CONSTRAINT fk_activities_status_catalog
        FOREIGN KEY (status) REFERENCES activity_statuses(code);
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_activities_type_catalog'
      ) THEN
        ALTER TABLE activities
        ADD CONSTRAINT fk_activities_type_catalog
        FOREIGN KEY (activity_type_code) REFERENCES activity_types(code);
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_activities_priority_catalog'
      ) THEN
        ALTER TABLE activities
        ADD CONSTRAINT fk_activities_priority_catalog
        FOREIGN KEY (priority_code) REFERENCES activity_priorities(code);
      END IF;
    END $$;
  `);
}

export async function down(knex) {
  await knex.raw('ALTER TABLE activities DROP CONSTRAINT IF EXISTS fk_activities_priority_catalog');
  await knex.raw('ALTER TABLE activities DROP CONSTRAINT IF EXISTS fk_activities_type_catalog');
  await knex.raw('ALTER TABLE activities DROP CONSTRAINT IF EXISTS fk_activities_status_catalog');
  await knex.raw('ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_status_catalog');

  if (await knex.schema.hasColumn('activities', 'priority_code')) {
    await knex.schema.alterTable('activities', (table) => {
      table.dropColumn('priority_code');
    });
  }

  if (await knex.schema.hasColumn('activities', 'activity_type_code')) {
    await knex.schema.alterTable('activities', (table) => {
      table.dropColumn('activity_type_code');
    });
  }

  await knex.schema.dropTableIfExists('activity_priorities');
  await knex.schema.dropTableIfExists('activity_types');
  await knex.schema.dropTableIfExists('activity_statuses');
  await knex.schema.dropTableIfExists('project_statuses');
}
