export async function up(knex) {
  const hasPeriods = await knex.schema.hasTable('project_control_periods');
  if (!hasPeriods) {
    await knex.schema.createTable('project_control_periods', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('period_code', 60).notNullable();
      table.string('name', 160).notNullable();
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.string('status_code', 20).notNullable().defaultTo('open');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('opened_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('closed_at', { useTz: true }).nullable();
      table.timestamp('reopened_at', { useTz: true }).nullable();
      table.text('close_notes').notNullable().defaultTo('');
      table.integer('summary_activity_count').notNullable().defaultTo(0);
      table.decimal('summary_budget_hours', 16, 2).notNullable().defaultTo(0);
      table.decimal('summary_budget_cost', 16, 2).notNullable().defaultTo(0);
      table.decimal('summary_weighted_progress', 8, 2).notNullable().defaultTo(0);
      table.integer('summary_completed_activities').notNullable().defaultTo(0);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.unique(['project_id', 'period_code']);
    });

    await knex.raw(`
      ALTER TABLE project_control_periods
      ADD CONSTRAINT chk_project_control_periods_status
      CHECK (status_code IN ('open', 'closed', 'reopened'))
    `).catch(() => {});
  }

  const hasSnapshots = await knex.schema.hasTable('project_control_period_activity_snapshots');
  if (!hasSnapshots) {
    await knex.schema.createTable('project_control_period_activity_snapshots', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_control_period_id').notNullable().references('id').inTable('project_control_periods').onDelete('CASCADE');
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.uuid('activity_id').nullable().references('id').inTable('activities').onDelete('SET NULL');
      table.uuid('wbs_id').nullable().references('id').inTable('wbs_nodes').onDelete('SET NULL');
      table.string('wbs_code', 80).notNullable().defaultTo('');
      table.string('wbs_name', 255).notNullable().defaultTo('');
      table.string('activity_code', 80).notNullable().defaultTo('');
      table.string('activity_name', 255).notNullable().defaultTo('');
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      table.integer('duration_days').notNullable().defaultTo(0);
      table.decimal('progress_percent', 8, 2).notNullable().defaultTo(0);
      table.decimal('budget_hours', 16, 2).notNullable().defaultTo(0);
      table.decimal('budget_cost', 16, 2).notNullable().defaultTo(0);
      table.string('status_code', 50).notNullable().defaultTo('not_started');
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamp('captured_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_control_periods_project_id ON project_control_periods(project_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_control_periods_status_code ON project_control_periods(status_code)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_control_period_snapshots_period_id ON project_control_period_activity_snapshots(project_control_period_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_control_period_snapshots_project_id ON project_control_period_activity_snapshots(project_id)');
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_project_control_period_snapshots_project_id');
  await knex.raw('DROP INDEX IF EXISTS idx_project_control_period_snapshots_period_id');
  await knex.raw('DROP INDEX IF EXISTS idx_project_control_periods_status_code');
  await knex.raw('DROP INDEX IF EXISTS idx_project_control_periods_project_id');
  await knex.raw('ALTER TABLE project_control_periods DROP CONSTRAINT IF EXISTS chk_project_control_periods_status').catch(() => {});

  await knex.schema.dropTableIfExists('project_control_period_activity_snapshots');
  await knex.schema.dropTableIfExists('project_control_periods');
}
