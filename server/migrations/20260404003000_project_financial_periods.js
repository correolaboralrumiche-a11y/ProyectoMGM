export async function up(knex) {
  const hasFinancialPeriods = await knex.schema.hasTable('project_financial_periods');
  if (!hasFinancialPeriods) {
    await knex.schema.createTable('project_financial_periods', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('period_code', 60).notNullable();
      table.string('name', 160).notNullable();
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
      table.unique(['project_id', 'cutoff_date']);
    });
  }

  const hasPeriods = await knex.schema.hasTable('project_control_periods');
  if (hasPeriods) {
    const periodColumns = [
      ['financial_period_id', (table) => table.uuid('financial_period_id').nullable().references('id').inTable('project_financial_periods').onDelete('SET NULL')],
      ['snapshot_date', (table) => table.date('snapshot_date').nullable()],
    ];

    for (const [name, addColumn] of periodColumns) {
      const exists = await knex.schema.hasColumn('project_control_periods', name);
      if (!exists) {
        await knex.schema.alterTable('project_control_periods', addColumn);
      }
    }

    await knex.raw(`
      UPDATE project_control_periods
      SET snapshot_date = COALESCE(snapshot_date, end_date)
      WHERE snapshot_date IS NULL
    `).catch(() => {});
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_financial_periods_project_id ON project_financial_periods(project_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_financial_periods_cutoff_date ON project_financial_periods(cutoff_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_project_control_periods_financial_period_id ON project_control_periods(financial_period_id)').catch(() => {});
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_project_control_periods_financial_period_active
    ON project_control_periods(financial_period_id)
    WHERE financial_period_id IS NOT NULL AND is_active = TRUE
  `).catch(() => {});
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS ux_project_control_periods_financial_period_active').catch(() => {});
  await knex.raw('DROP INDEX IF EXISTS idx_project_control_periods_financial_period_id').catch(() => {});
  await knex.raw('DROP INDEX IF EXISTS idx_project_financial_periods_cutoff_date').catch(() => {});
  await knex.raw('DROP INDEX IF EXISTS idx_project_financial_periods_project_id').catch(() => {});

  const hasPeriods = await knex.schema.hasTable('project_control_periods');
  if (hasPeriods) {
    for (const column of ['snapshot_date', 'financial_period_id']) {
      const exists = await knex.schema.hasColumn('project_control_periods', column);
      if (exists) {
        await knex.schema.alterTable('project_control_periods', (table) => table.dropColumn(column));
      }
    }
  }

  await knex.schema.dropTableIfExists('project_financial_periods');
}
