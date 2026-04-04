export async function up(knex) {
  const adminUser = await knex('users')
    .select('id')
    .whereRaw('LOWER(username) = LOWER(?)', ['admin'])
    .first()
    .catch(() => null);

  const actorId = adminUser?.id || null;

  async function ensureColumn(tableName, columnName, alterCallback) {
    const exists = await knex.schema.hasColumn(tableName, columnName);
    if (!exists) {
      await knex.schema.alterTable(tableName, alterCallback);
    }
  }

  async function ensureCatalogTable(tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
      await knex.schema.createTable(tableName, (table) => {
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
  }

  async function seedCatalog(tableName, rows) {
    for (const row of rows) {
      await knex(tableName)
        .insert({
          ...row,
          created_by: actorId,
          updated_by: actorId,
        })
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
  }

  async function addForeignKeyIfMissing(constraintName, tableName, columnName, targetTable, targetColumn = 'code', onDelete = 'RESTRICT') {
    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = '${constraintName}'
        ) THEN
          ALTER TABLE ${tableName}
          ADD CONSTRAINT ${constraintName}
          FOREIGN KEY (${columnName})
          REFERENCES ${targetTable}(${targetColumn})
          ON DELETE ${onDelete};
        END IF;
      END $$;
    `);
  }

  async function addProjectUserForeignKeyIfMissing(constraintName, tableName, columnName) {
    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = '${constraintName}'
        ) THEN
          ALTER TABLE ${tableName}
          ADD CONSTRAINT ${constraintName}
          FOREIGN KEY (${columnName})
          REFERENCES users(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  await ensureCatalogTable('project_priorities');
  await ensureCatalogTable('currencies');
  await ensureCatalogTable('disciplines');
  await ensureCatalogTable('deliverable_types');
  await ensureCatalogTable('deliverable_statuses');
  await ensureCatalogTable('document_response_codes');
  await ensureCatalogTable('revision_purposes');

  await seedCatalog('project_priorities', [
    { code: 'low', name: 'Low', description: 'Prioridad baja', is_active: true, sort_order: 10 },
    { code: 'medium', name: 'Medium', description: 'Prioridad media', is_active: true, sort_order: 20 },
    { code: 'high', name: 'High', description: 'Prioridad alta', is_active: true, sort_order: 30 },
    { code: 'critical', name: 'Critical', description: 'Prioridad crítica', is_active: true, sort_order: 40 },
  ]);

  await seedCatalog('currencies', [
    { code: 'USD', name: 'US Dollar', description: 'United States Dollar', is_active: true, sort_order: 10 },
    { code: 'PEN', name: 'Peruvian Sol', description: 'Peruvian Sol', is_active: true, sort_order: 20 },
    { code: 'EUR', name: 'Euro', description: 'Euro', is_active: true, sort_order: 30 },
  ]);

  await seedCatalog('disciplines', [
    { code: 'general', name: 'General', description: 'General discipline', is_active: true, sort_order: 10 },
    { code: 'civil', name: 'Civil', description: 'Civil discipline', is_active: true, sort_order: 20 },
    { code: 'structural', name: 'Structural', description: 'Structural discipline', is_active: true, sort_order: 30 },
    { code: 'mechanical', name: 'Mechanical', description: 'Mechanical discipline', is_active: true, sort_order: 40 },
    { code: 'electrical', name: 'Electrical', description: 'Electrical discipline', is_active: true, sort_order: 50 },
    { code: 'process', name: 'Process', description: 'Process discipline', is_active: true, sort_order: 60 },
    { code: 'planning', name: 'Planning', description: 'Planning and control', is_active: true, sort_order: 70 },
  ]);

  await seedCatalog('deliverable_types', [
    { code: 'drawing', name: 'Drawing', description: 'Plano o dibujo', is_active: true, sort_order: 10 },
    { code: 'report', name: 'Report', description: 'Reporte o informe', is_active: true, sort_order: 20 },
    { code: 'calculation', name: 'Calculation', description: 'Memoria de cálculo', is_active: true, sort_order: 30 },
    { code: 'datasheet', name: 'Datasheet', description: 'Hoja de datos', is_active: true, sort_order: 40 },
    { code: 'specification', name: 'Specification', description: 'Especificación', is_active: true, sort_order: 50 },
    { code: 'procedure', name: 'Procedure', description: 'Procedimiento', is_active: true, sort_order: 60 },
    { code: 'other', name: 'Other', description: 'Otro tipo de documento', is_active: true, sort_order: 70 },
  ]);

  await seedCatalog('deliverable_statuses', [
    { code: 'draft', name: 'Draft', description: 'Borrador', is_active: true, sort_order: 10 },
    { code: 'issued', name: 'Issued', description: 'Emitido', is_active: true, sort_order: 20 },
    { code: 'under_review', name: 'Under Review', description: 'En revisión', is_active: true, sort_order: 30 },
    { code: 'responded', name: 'Responded', description: 'Respondido', is_active: true, sort_order: 40 },
    { code: 'returned_for_update', name: 'Returned for Update', description: 'Devuelto para actualización', is_active: true, sort_order: 50 },
    { code: 'closed', name: 'Closed', description: 'Cerrado', is_active: true, sort_order: 60 },
  ]);

  await seedCatalog('document_response_codes', [
    { code: 'approved', name: 'Approved', description: 'Aprobado', is_active: true, sort_order: 10 },
    { code: 'approved_with_comments', name: 'Approved with Comments', description: 'Aprobado con comentarios', is_active: true, sort_order: 20 },
    { code: 'for_information', name: 'For Information', description: 'Solo información', is_active: true, sort_order: 30 },
    { code: 'no_response_required', name: 'No Response Required', description: 'No requiere respuesta', is_active: true, sort_order: 40 },
    { code: 'revise_and_resubmit', name: 'Revise and Resubmit', description: 'Revisar y reenviar', is_active: true, sort_order: 50 },
    { code: 'rejected', name: 'Rejected', description: 'Rechazado', is_active: true, sort_order: 60 },
  ]);

  await seedCatalog('revision_purposes', [
    { code: 'ifa', name: 'Issued for Approval', description: 'Emitido para aprobación', is_active: true, sort_order: 10 },
    { code: 'ifr', name: 'Issued for Review', description: 'Emitido para revisión', is_active: true, sort_order: 20 },
    { code: 'ifc', name: 'Issued for Construction', description: 'Emitido para construcción', is_active: true, sort_order: 30 },
    { code: 'info', name: 'For Information', description: 'Emitido para información', is_active: true, sort_order: 40 },
  ]);

  await ensureColumn('projects', 'priority_code', (table) => {
    table.string('priority_code', 50).notNullable().defaultTo('medium');
  });
  await ensureColumn('projects', 'currency_code', (table) => {
    table.string('currency_code', 50).notNullable().defaultTo('USD');
  });

  await knex.raw(`
    UPDATE projects
    SET priority_code = COALESCE(NULLIF(BTRIM(priority_code), ''), 'medium'),
        currency_code = COALESCE(NULLIF(BTRIM(currency_code), ''), 'USD')
  `);

  await addForeignKeyIfMissing('fk_projects_priority_catalog', 'projects', 'priority_code', 'project_priorities', 'code', 'RESTRICT');
  await addForeignKeyIfMissing('fk_projects_currency_catalog', 'projects', 'currency_code', 'currencies', 'code', 'RESTRICT');

  await ensureColumn('activities', 'discipline_code', (table) => {
    table.string('discipline_code', 50).notNullable().defaultTo('general');
  });

  await knex.raw(`
    UPDATE activities
    SET discipline_code = COALESCE(NULLIF(BTRIM(discipline_code), ''), 'general')
  `);

  await addForeignKeyIfMissing('fk_activities_discipline_catalog', 'activities', 'discipline_code', 'disciplines', 'code', 'RESTRICT');

  await ensureColumn('project_baselines', 'created_by', (table) => {
    table.uuid('created_by').nullable();
  });
  await ensureColumn('project_baselines', 'updated_by', (table) => {
    table.uuid('updated_by').nullable();
  });
  await ensureColumn('project_baselines', 'updated_at', (table) => {
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await addProjectUserForeignKeyIfMissing('fk_project_baselines_created_by_user', 'project_baselines', 'created_by');
  await addProjectUserForeignKeyIfMissing('fk_project_baselines_updated_by_user', 'project_baselines', 'updated_by');

  const hasDeliverables = await knex.schema.hasTable('deliverables');
  if (!hasDeliverables) {
    await knex.schema.createTable('deliverables', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.uuid('wbs_id').nullable().references('id').inTable('wbs_nodes').onDelete('SET NULL');
      table.uuid('activity_id').nullable().references('id').inTable('activities').onDelete('SET NULL');
      table.string('document_code', 150).notNullable();
      table.string('title', 255).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.string('deliverable_type_code', 50).notNullable().defaultTo('drawing');
      table.string('discipline_code', 50).notNullable().defaultTo('general');
      table.string('priority_code', 50).notNullable().defaultTo('medium');
      table.string('status_code', 50).notNullable().defaultTo('draft');
      table.string('originator', 120).notNullable().defaultTo('');
      table.string('responsible_person', 160).notNullable().defaultTo('');
      table.string('spec_section', 120).notNullable().defaultTo('');
      table.string('package_no', 120).notNullable().defaultTo('');
      table.date('planned_issue_date').nullable();
      table.date('forecast_issue_date').nullable();
      table.date('actual_issue_date').nullable();
      table.date('planned_response_date').nullable();
      table.date('forecast_response_date').nullable();
      table.date('actual_response_date').nullable();
      table.string('current_revision_code', 50).notNullable().defaultTo('');
      table.string('current_response_code', 50).nullable();
      table.string('current_issue_transmittal_no', 120).notNullable().defaultTo('');
      table.string('current_response_transmittal_no', 120).notNullable().defaultTo('');
      table.text('remarks').notNullable().defaultTo('');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['project_id']);
      table.index(['wbs_id']);
      table.index(['activity_id']);
      table.index(['status_code']);
      table.index(['discipline_code']);
      table.unique(['document_code']);
    });
  }

  await addForeignKeyIfMissing('fk_deliverables_type_catalog', 'deliverables', 'deliverable_type_code', 'deliverable_types', 'code', 'RESTRICT');
  await addForeignKeyIfMissing('fk_deliverables_discipline_catalog', 'deliverables', 'discipline_code', 'disciplines', 'code', 'RESTRICT');
  await addForeignKeyIfMissing('fk_deliverables_priority_catalog', 'deliverables', 'priority_code', 'project_priorities', 'code', 'RESTRICT');
  await addForeignKeyIfMissing('fk_deliverables_status_catalog', 'deliverables', 'status_code', 'deliverable_statuses', 'code', 'RESTRICT');
  await addForeignKeyIfMissing('fk_deliverables_response_catalog', 'deliverables', 'current_response_code', 'document_response_codes', 'code', 'SET NULL');

  const hasDeliverableRevisions = await knex.schema.hasTable('deliverable_revisions');
  if (!hasDeliverableRevisions) {
    await knex.schema.createTable('deliverable_revisions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('deliverable_id').notNullable().references('id').inTable('deliverables').onDelete('CASCADE');
      table.integer('revision_sequence').notNullable();
      table.string('revision_code', 50).notNullable();
      table.string('issue_purpose_code', 50).notNullable().defaultTo('ifa');
      table.date('issue_date').nullable();
      table.string('issue_transmittal_no', 120).notNullable().defaultTo('');
      table.date('planned_response_date').nullable();
      table.date('response_date').nullable();
      table.string('response_code', 50).nullable();
      table.string('response_transmittal_no', 120).notNullable().defaultTo('');
      table.string('response_by', 160).notNullable().defaultTo('');
      table.text('remarks').notNullable().defaultTo('');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['deliverable_id', 'revision_sequence']);
      table.unique(['deliverable_id', 'revision_code']);
      table.index(['deliverable_id']);
    });
  }

  await addForeignKeyIfMissing('fk_deliverable_revisions_purpose_catalog', 'deliverable_revisions', 'issue_purpose_code', 'revision_purposes', 'code', 'RESTRICT');
  await addForeignKeyIfMissing('fk_deliverable_revisions_response_catalog', 'deliverable_revisions', 'response_code', 'document_response_codes', 'code', 'SET NULL');

  const hasFinancialPeriods = await knex.schema.hasTable('project_financial_periods');
  if (!hasFinancialPeriods) {
    await knex.schema.createTable('project_financial_periods', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('period_code', 50).notNullable();
      table.string('name', 120).notNullable();
      table.date('start_date').notNullable();
      table.date('cutoff_date').notNullable();
      table.date('end_date').notNullable();
      table.integer('sort_order').notNullable().defaultTo(0);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['project_id', 'period_code']);
      table.index(['project_id', 'start_date']);
      table.index(['project_id', 'cutoff_date']);
    });
  }

  const hasControlPeriods = await knex.schema.hasTable('project_control_periods');
  if (!hasControlPeriods) {
    await knex.schema.createTable('project_control_periods', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.uuid('financial_period_id').notNullable().references('id').inTable('project_financial_periods').onDelete('RESTRICT');
      table.string('period_code', 50).notNullable();
      table.string('name', 120).notNullable();
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.date('snapshot_date').nullable();
      table.string('status_code', 30).notNullable().defaultTo('open');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('opened_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('closed_at', { useTz: true }).nullable();
      table.timestamp('reopened_at', { useTz: true }).nullable();
      table.text('close_notes').notNullable().defaultTo('');
      table.integer('summary_activity_count').notNullable().defaultTo(0);
      table.decimal('summary_budget_hours', 14, 2).notNullable().defaultTo(0);
      table.decimal('summary_budget_cost', 14, 2).notNullable().defaultTo(0);
      table.decimal('summary_baseline_budget_hours', 14, 2).notNullable().defaultTo(0);
      table.decimal('summary_baseline_budget_cost', 14, 2).notNullable().defaultTo(0);
      table.decimal('summary_ev_amount', 14, 2).notNullable().defaultTo(0);
      table.decimal('summary_weighted_progress', 5, 2).notNullable().defaultTo(0);
      table.integer('summary_completed_activities').notNullable().defaultTo(0);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['project_id', 'start_date']);
      table.index(['financial_period_id']);
    });
    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_project_control_periods_financial_period_active
      ON project_control_periods (financial_period_id)
      WHERE is_active = TRUE
    `);
  }

  const hasControlPeriodSnapshots = await knex.schema.hasTable('project_control_period_activity_snapshots');
  if (!hasControlPeriodSnapshots) {
    await knex.schema.createTable('project_control_period_activity_snapshots', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_control_period_id').notNullable().references('id').inTable('project_control_periods').onDelete('CASCADE');
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.uuid('activity_id').nullable().references('id').inTable('activities').onDelete('SET NULL');
      table.uuid('wbs_id').nullable().references('id').inTable('wbs_nodes').onDelete('SET NULL');
      table.string('wbs_code', 100).notNullable().defaultTo('');
      table.string('wbs_name', 255).notNullable().defaultTo('');
      table.string('activity_code', 100).notNullable().defaultTo('');
      table.string('activity_name', 255).notNullable().defaultTo('');
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      table.decimal('duration_days', 10, 2).notNullable().defaultTo(0);
      table.decimal('progress_percent', 5, 2).notNullable().defaultTo(0);
      table.decimal('budget_hours', 14, 2).notNullable().defaultTo(0);
      table.decimal('budget_cost', 14, 2).notNullable().defaultTo(0);
      table.date('baseline_start_date').nullable();
      table.date('baseline_end_date').nullable();
      table.decimal('baseline_duration_days', 10, 2).notNullable().defaultTo(0);
      table.decimal('baseline_budget_hours', 14, 2).notNullable().defaultTo(0);
      table.decimal('baseline_budget_cost', 14, 2).notNullable().defaultTo(0);
      table.decimal('ev_amount', 14, 2).notNullable().defaultTo(0);
      table.string('status_code', 50).notNullable().defaultTo('not_started');
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['project_control_period_id']);
      table.index(['project_id']);
      table.index(['activity_id']);
      table.index(['wbs_id']);
    });
    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_control_period_snapshots_period_activity
      ON project_control_period_activity_snapshots (project_control_period_id, activity_id)
      WHERE activity_id IS NOT NULL
    `);
  }
}

export async function down() {
  // Intentionally left as a no-op.
  // This migration aligns an existing runtime schema with the current ERP runtime
  // and seeds mandatory catalogs required by the live codebase.
}
