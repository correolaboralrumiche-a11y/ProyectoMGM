export async function up(knex) {
  const hasProjectBaselines = await knex.schema.hasTable('project_baselines');
  if (!hasProjectBaselines) {
    await knex.schema.createTable('project_baselines', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('name', 160).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.string('project_name_snapshot', 255).notNullable().defaultTo('');
      table.text('project_description_snapshot').notNullable().defaultTo('');
      table.timestamp('source_project_created_at', { useTz: true }).nullable();
      table.string('baseline_type', 40).notNullable().defaultTo('MANUAL');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.unique(['project_id', 'name']);
    });
  }

  const hasBaselineWbs = await knex.schema.hasTable('baseline_wbs');
  if (!hasBaselineWbs) {
    await knex.schema.createTable('baseline_wbs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('baseline_id').notNullable().references('id').inTable('project_baselines').onDelete('CASCADE');
      table.uuid('source_wbs_id').nullable().references('id').inTable('wbs_nodes').onDelete('SET NULL');
      table.uuid('parent_id').nullable().references('id').inTable('baseline_wbs').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('code', 100).notNullable();
      table.integer('sort_order').notNullable().defaultTo(0);
      table.unique(['baseline_id', 'code']);
    });
  }

  const hasBaselineActivities = await knex.schema.hasTable('baseline_activities');
  if (!hasBaselineActivities) {
    await knex.schema.createTable('baseline_activities', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('baseline_id').notNullable().references('id').inTable('project_baselines').onDelete('CASCADE');
      table.uuid('baseline_wbs_id').notNullable().references('id').inTable('baseline_wbs').onDelete('CASCADE');
      table.uuid('source_activity_id').nullable().references('id').inTable('activities').onDelete('SET NULL');
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('activity_id', 100).notNullable();
      table.string('name', 255).notNullable();
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      table.decimal('duration', 10, 2).notNullable().defaultTo(0);
      table.decimal('progress', 8, 2).notNullable().defaultTo(0);
      table.decimal('hours', 16, 2).notNullable().defaultTo(0);
      table.decimal('cost', 16, 2).notNullable().defaultTo(0);
      table.string('status', 50).notNullable().defaultTo('not_started');
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamp('source_created_at', { useTz: true }).nullable();
      table.timestamp('source_updated_at', { useTz: true }).nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.index(['baseline_id', 'source_activity_id']);
    });
  }

  const hasPeriods = await knex.schema.hasTable('project_control_periods');
  if (hasPeriods) {
    const periodColumns = [
      ['summary_baseline_budget_hours', (table) => table.decimal('summary_baseline_budget_hours', 16, 2).notNullable().defaultTo(0)],
      ['summary_baseline_budget_cost', (table) => table.decimal('summary_baseline_budget_cost', 16, 2).notNullable().defaultTo(0)],
      ['summary_ev_amount', (table) => table.decimal('summary_ev_amount', 16, 2).notNullable().defaultTo(0)],
    ];

    for (const [name, addColumn] of periodColumns) {
      const exists = await knex.schema.hasColumn('project_control_periods', name);
      if (!exists) {
        await knex.schema.alterTable('project_control_periods', addColumn);
      }
    }
  }

  const hasSnapshots = await knex.schema.hasTable('project_control_period_activity_snapshots');
  if (hasSnapshots) {
    const snapshotColumns = [
      ['baseline_start_date', (table) => table.date('baseline_start_date').nullable()],
      ['baseline_end_date', (table) => table.date('baseline_end_date').nullable()],
      ['baseline_duration_days', (table) => table.decimal('baseline_duration_days', 10, 2).notNullable().defaultTo(0)],
      ['baseline_budget_hours', (table) => table.decimal('baseline_budget_hours', 16, 2).notNullable().defaultTo(0)],
      ['baseline_budget_cost', (table) => table.decimal('baseline_budget_cost', 16, 2).notNullable().defaultTo(0)],
      ['ev_amount', (table) => table.decimal('ev_amount', 16, 2).notNullable().defaultTo(0)],
    ];

    for (const [name, addColumn] of snapshotColumns) {
      const exists = await knex.schema.hasColumn('project_control_period_activity_snapshots', name);
      if (!exists) {
        await knex.schema.alterTable('project_control_period_activity_snapshots', addColumn);
      }
    }
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_baselines_project_created ON project_baselines(project_id, created_at DESC)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_baseline_wbs_baseline_id ON baseline_wbs(baseline_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_baseline_activities_baseline_id ON baseline_activities(baseline_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_baseline_activities_source_activity_id ON baseline_activities(source_activity_id)');
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_baseline_activities_source_activity_id');
  await knex.raw('DROP INDEX IF EXISTS idx_baseline_activities_baseline_id');
  await knex.raw('DROP INDEX IF EXISTS idx_baseline_wbs_baseline_id');
  await knex.raw('DROP INDEX IF EXISTS idx_project_baselines_project_created');

  const hasSnapshots = await knex.schema.hasTable('project_control_period_activity_snapshots');
  if (hasSnapshots) {
    for (const column of ['ev_amount', 'baseline_budget_cost', 'baseline_budget_hours', 'baseline_duration_days', 'baseline_end_date', 'baseline_start_date']) {
      const exists = await knex.schema.hasColumn('project_control_period_activity_snapshots', column);
      if (exists) {
        await knex.schema.alterTable('project_control_period_activity_snapshots', (table) => table.dropColumn(column));
      }
    }
  }

  const hasPeriods = await knex.schema.hasTable('project_control_periods');
  if (hasPeriods) {
    for (const column of ['summary_ev_amount', 'summary_baseline_budget_cost', 'summary_baseline_budget_hours']) {
      const exists = await knex.schema.hasColumn('project_control_periods', column);
      if (exists) {
        await knex.schema.alterTable('project_control_periods', (table) => table.dropColumn(column));
      }
    }
  }

  await knex.schema.dropTableIfExists('baseline_activities');
  await knex.schema.dropTableIfExists('baseline_wbs');
  await knex.schema.dropTableIfExists('project_baselines');
}
