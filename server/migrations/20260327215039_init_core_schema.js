export async function up(knex) {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await knex.schema.createTable('projects', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));

    table.string('code', 50).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('status', 50).notNullable().defaultTo('active');

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('wbs_nodes', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');

    table
      .uuid('parent_id')
      .nullable()
      .references('id')
      .inTable('wbs_nodes')
      .onDelete('CASCADE');

    table.string('code', 100).notNullable();
    table.string('name', 255).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['project_id', 'code']);
    table.index(['project_id']);
    table.index(['parent_id']);
    table.index(['project_id', 'parent_id']);
    table.index(['project_id', 'sort_order']);
  });

  await knex.schema.createTable('activities', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');

    table
      .uuid('wbs_id')
      .notNullable()
      .references('id')
      .inTable('wbs_nodes')
      .onDelete('CASCADE');

    table.string('activity_id', 100).notNullable();
    table.string('name', 255).notNullable();

    table.date('start_date').nullable();
    table.date('finish_date').nullable();

    table.decimal('duration_days', 10, 2).notNullable().defaultTo(0);
    table.decimal('progress_percent', 5, 2).notNullable().defaultTo(0);
    table.decimal('budget_hours', 14, 2).notNullable().defaultTo(0);
    table.decimal('budget_cost', 14, 2).notNullable().defaultTo(0);

    table.string('status', 50).notNullable().defaultTo('not_started');
    table.integer('sort_order').notNullable().defaultTo(0);

    table.text('notes').nullable();

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['project_id', 'activity_id']);
    table.index(['project_id']);
    table.index(['wbs_id']);
    table.index(['project_id', 'wbs_id']);
    table.index(['project_id', 'sort_order']);
  });

  await knex.raw(`
    ALTER TABLE activities
    ADD CONSTRAINT chk_activities_progress_percent
    CHECK (progress_percent >= 0 AND progress_percent <= 100)
  `);

  await knex.raw(`
    ALTER TABLE activities
    ADD CONSTRAINT chk_activities_duration_days
    CHECK (duration_days >= 0)
  `);

  await knex.raw(`
    ALTER TABLE activities
    ADD CONSTRAINT chk_activities_budget_hours
    CHECK (budget_hours >= 0)
  `);

  await knex.raw(`
    ALTER TABLE activities
    ADD CONSTRAINT chk_activities_budget_cost
    CHECK (budget_cost >= 0)
  `);

  await knex.raw(`
    ALTER TABLE activities
    ADD CONSTRAINT chk_activities_dates
    CHECK (
      start_date IS NULL
      OR finish_date IS NULL
      OR finish_date >= start_date
    )
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('activities');
  await knex.schema.dropTableIfExists('wbs_nodes');
  await knex.schema.dropTableIfExists('projects');
}
