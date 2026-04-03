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
    });
  } else {
    const projectBaselineColumns = [
      ['description', (table) => table.text('description').notNullable().defaultTo('')],
      ['project_name_snapshot', (table) => table.string('project_name_snapshot', 255).notNullable().defaultTo('')],
      ['project_description_snapshot', (table) => table.text('project_description_snapshot').notNullable().defaultTo('')],
      ['source_project_created_at', (table) => table.timestamp('source_project_created_at', { useTz: true }).nullable()],
      ['baseline_type', (table) => table.string('baseline_type', 40).notNullable().defaultTo('MANUAL')],
      ['created_by', (table) => table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')],
      ['updated_by', (table) => table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')],
      ['created_at', (table) => table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())],
      ['updated_at', (table) => table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())],
    ];

    for (const [columnName, addColumn] of projectBaselineColumns) {
      const exists = await knex.schema.hasColumn('project_baselines', columnName);
      if (!exists) {
        await knex.schema.alterTable('project_baselines', addColumn);
      }
    }
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
    });
  } else {
    const baselineWbsColumns = [
      ['source_wbs_id', (table) => table.uuid('source_wbs_id').nullable().references('id').inTable('wbs_nodes').onDelete('SET NULL')],
      ['parent_id', (table) => table.uuid('parent_id').nullable().references('id').inTable('baseline_wbs').onDelete('CASCADE')],
      ['sort_order', (table) => table.integer('sort_order').notNullable().defaultTo(0)],
    ];

    for (const [columnName, addColumn] of baselineWbsColumns) {
      const exists = await knex.schema.hasColumn('baseline_wbs', columnName);
      if (!exists) {
        await knex.schema.alterTable('baseline_wbs', addColumn);
      }
    }
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
    });
  } else {
    const baselineActivityColumns = [
      ['source_activity_id', (table) => table.uuid('source_activity_id').nullable().references('id').inTable('activities').onDelete('SET NULL')],
      ['project_id', (table) => table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE')],
      ['start_date', (table) => table.date('start_date').nullable()],
      ['end_date', (table) => table.date('end_date').nullable()],
      ['duration', (table) => table.decimal('duration', 10, 2).notNullable().defaultTo(0)],
      ['progress', (table) => table.decimal('progress', 8, 2).notNullable().defaultTo(0)],
      ['hours', (table) => table.decimal('hours', 16, 2).notNullable().defaultTo(0)],
      ['cost', (table) => table.decimal('cost', 16, 2).notNullable().defaultTo(0)],
      ['status', (table) => table.string('status', 50).notNullable().defaultTo('not_started')],
      ['sort_order', (table) => table.integer('sort_order').notNullable().defaultTo(0)],
      ['source_created_at', (table) => table.timestamp('source_created_at', { useTz: true }).nullable()],
      ['source_updated_at', (table) => table.timestamp('source_updated_at', { useTz: true }).nullable()],
      ['created_at', (table) => table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())],
    ];

    for (const [columnName, addColumn] of baselineActivityColumns) {
      const exists = await knex.schema.hasColumn('baseline_activities', columnName);
      if (!exists) {
        await knex.schema.alterTable('baseline_activities', addColumn);
      }
    }
  }

  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_project_baselines_project_name ON project_baselines(project_id, name)');
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_baseline_wbs_baseline_code ON baseline_wbs(baseline_id, code)');
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
  await knex.raw('DROP INDEX IF EXISTS uq_baseline_wbs_baseline_code');
  await knex.raw('DROP INDEX IF EXISTS uq_project_baselines_project_name');
}
